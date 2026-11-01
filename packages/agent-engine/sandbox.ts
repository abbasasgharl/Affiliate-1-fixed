import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { env } from 'node:process';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { AgentTask, GeneratedFile, ValidationReport } from './index.ts';

export interface SandboxWorkspace {
  /** Absolute path to a disposable checkout containing the full project plus the proposed files. */
  path: string;
  cleanup(): Promise<void>;
}

/**
 * Implement this outside the API process. It must materialize a disposable project checkout,
 * overlay only the supplied generated files, reject path traversal/symlinks, and never copy
 * credentials, .git, node_modules, or production data into the workspace.
 */
export interface SandboxWorkspaceProvider {
  prepare(task: AgentTask, files: GeneratedFile[]): Promise<SandboxWorkspace>;
}

export interface DockerSandboxOptions {
  /** A prebuilt image pinned by sha256 digest, e.g. registry.example/agent-checks@sha256:<64 hex>. */
  image: string;
  timeoutMs?: number;
  memoryMb?: number;
  cpus?: number;
  pidsLimit?: number;
  maxOutputBytes?: number;
  dockerBinary?: string;
}

const CHECK_SCRIPT =
  'npm install --ignore-scripts --offline --no-audit --no-fund && ' +
  'npm run lint --if-present && npm run build --if-present && npm run test --if-present';

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(value ?? fallback)));

function validateImage(image: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('Sandbox image must be a valid image reference pinned by sha256 digest.');
  }
}

function appendBounded(current: string, chunk: Buffer, limit: number): { value: string; overflow: boolean } {
  const remaining = Math.max(0, limit - Buffer.byteLength(current, 'utf8'));
  const value = chunk.subarray(0, remaining).toString('utf8');
  return { value: current + value, overflow: chunk.length > remaining };
}

/**
 * Runs a fixed validation pipeline in Docker. No task-supplied command, image, environment
 * variable, volume, or network setting is accepted. The Docker daemon must be on a dedicated
 * worker host; never expose its socket to the AffiliateOS API container.
 */
export class DockerSandboxValidator {
  private readonly timeoutMs: number;
  private readonly memoryMb: number;
  private readonly cpus: number;
  private readonly pidsLimit: number;
  private readonly maxOutputBytes: number;
  private readonly dockerBinary: string;

  constructor(
    private readonly workspaces: SandboxWorkspaceProvider,
    private readonly options: DockerSandboxOptions,
  ) {
    validateImage(options.image);
    this.timeoutMs = bounded(options.timeoutMs, 180_000, 10_000, 600_000);
    this.memoryMb = bounded(options.memoryMb, 1024, 256, 4096);
    this.cpus = Math.max(0.25, Math.min(options.cpus ?? 1, 4));
    this.pidsLimit = bounded(options.pidsLimit, 128, 32, 512);
    this.maxOutputBytes = bounded(options.maxOutputBytes, 256_000, 16_384, 1_000_000);
    this.dockerBinary = options.dockerBinary ?? 'docker';
  }

  async validate(files: GeneratedFile[], task: AgentTask): Promise<ValidationReport> {
    let workspace: SandboxWorkspace | undefined;
    try {
      workspace = await this.workspaces.prepare(task, files);
      const absolutePath = path.resolve(workspace.path);
      const info = await lstat(absolutePath);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error('Sandbox workspace must be a real directory.');
      }
      const source = await realpath(absolutePath);
      if (source.includes(',')) throw new Error('Sandbox workspace path contains an unsupported character.');

      const result = await this.runContainer(source);
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, this.maxOutputBytes);
      const findings = result.error
        ? [result.error]
        : result.timedOut
          ? ['Sandbox validation exceeded its execution time limit.']
          : result.outputLimit
            ? ['Sandbox output exceeded the configured limit.']
            : result.exitCode !== 0
              ? [`Validation container exited with code ${result.exitCode ?? 'unknown'}.`]
              : [];

      return {
        passed: findings.length === 0,
        checks: [
          'Docker isolated container',
          'network disabled',
          'read-only container root filesystem',
          'capabilities dropped and no-new-privileges enabled',
          'CPU, memory, process and time limits',
          'offline dependency installation with lifecycle scripts disabled',
          'lint, build and test scripts (when present)',
          ...(output ? [`container output: ${output}`] : []),
        ],
        findings,
      };
    } catch (error) {
      return {
        passed: false,
        checks: ['Docker sandbox preparation and execution'],
        findings: [error instanceof Error ? error.message : 'Unknown sandbox error.'],
      };
    } finally {
      if (workspace) await workspace.cleanup().catch(() => undefined);
    }
  }

  private runContainer(workspacePath: string): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    outputLimit: boolean;
    error?: string;
  }> {
    return new Promise(resolve => {
      const args = [
        'run', '--rm',
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        `--pids-limit=${this.pidsLimit}`,
        `--memory=${this.memoryMb}m`,
        `--memory-swap=${this.memoryMb}m`,
        `--cpus=${this.cpus}`,
        '--user=10001:10001',
        '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=128m',
        '--tmpfs=/home/worker:rw,noexec,nosuid,nodev,size=64m',
        '--workdir=/workspace',
        '--env=HOME=/tmp',
        '--env=CI=true',
        `--mount=type=bind,src=${workspacePath},dst=/workspace,rw`,
        this.options.image,
        '/bin/sh', '-lc', CHECK_SCRIPT,
      ];

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let outputLimit = false;
      let settled = false;
      const child = spawn(this.dockerBinary, args, {
        shell: false,
        windowsHide: true,
        env: { PATH: env.PATH ?? '/usr/bin:/bin', HOME: env.HOME ?? '/tmp' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const finish = (value: {
        exitCode: number | null; stdout: string; stderr: string;
        timedOut: boolean; outputLimit: boolean; error?: string;
      }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.timeoutMs);

      if (!child.stdout || !child.stderr) {
        child.kill('SIGKILL');
        finish({ exitCode: null, stdout, stderr, timedOut, outputLimit, error: 'Docker process streams could not be initialized.' });
        return;
      }

      child.stdout.on('data', (chunk: Buffer) => {
        const next = appendBounded(stdout, chunk, this.maxOutputBytes);
        stdout = next.value;
        if (next.overflow) { outputLimit = true; child.kill('SIGKILL'); }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const next = appendBounded(stderr, chunk, this.maxOutputBytes);
        stderr = next.value;
        if (next.overflow) { outputLimit = true; child.kill('SIGKILL'); }
      });
      child.on('error', error => finish({
        exitCode: null, stdout, stderr, timedOut, outputLimit,
        error: `Unable to start Docker: ${error.message}`,
      }));
      child.on('close', code => finish({ exitCode: code, stdout, stderr, timedOut, outputLimit }));
    });
  }
}
