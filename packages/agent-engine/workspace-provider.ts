import { mkdtemp, mkdir, lstat, readdir, copyFile, writeFile, unlink, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentTask, GeneratedFile } from './index.ts';
import type { SandboxWorkspace, SandboxWorkspaceProvider } from './sandbox.ts';

export interface LocalWorkspaceProviderOptions {
  /** Trusted, pre-checked-out project roots keyed by the persisted project ID. */
  projectRoots: Record<string, string>;
  /** Parent directory for disposable workspaces. Defaults to the operating system temp directory. */
  tempRoot?: string;
  maxSourceFiles?: number;
  maxSourceBytes?: number;
  maxGeneratedFiles?: number;
  maxGeneratedFileBytes?: number;
}

const excludedNames = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt',
  '.turbo', '.cache', '.vercel', '.output', '.ssh', '.aws', '.docker', '.config', '.ssh', '.aws', '.docker', '.config',
]);
const excludedFilePatterns = [
  /^\.env(?:\..*)?$/i,
  /^(?:id_rsa|id_ed25519|credentials(?:\.json)?|service-account(?:\.json)?)$/i,
  /\.(?:pem|key|p12|pfx)$/i,
];
const allowedPrefixes = ['src/', 'tests/', 'packages/', 'migrations/', 'docs/'];

function safeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some(part => !part || part === '.' || part === '..') ||
    !allowedPrefixes.some(prefix => normalized.startsWith(prefix)) ||
    normalized.split('/').some(part => excludedNames.has(part)) ||
    normalized.split('/').some(part => excludedFilePatterns.some(pattern => pattern.test(part)))
  ) {
    throw new Error(`Workspace policy rejected path: ${input}`);
  }
  return normalized;
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Copies a trusted local checkout into a private disposable directory and overlays model output.
 * Only project IDs mapped by server configuration are accepted; task input never supplies a
 * filesystem path. Symlinks and credential/build/dependency directories are not copied.
 */
export class LocalProjectWorkspaceProvider implements SandboxWorkspaceProvider {
  private readonly maxSourceFiles: number;
  private readonly maxSourceBytes: number;
  private readonly maxGeneratedFiles: number;
  private readonly maxGeneratedFileBytes: number;
  private readonly tempRoot: string;

  constructor(private readonly options: LocalWorkspaceProviderOptions) {
    this.maxSourceFiles = Math.max(100, Math.min(options.maxSourceFiles ?? 10_000, 50_000));
    this.maxSourceBytes = Math.max(1_000_000, Math.min(options.maxSourceBytes ?? 50_000_000, 250_000_000));
    this.maxGeneratedFiles = Math.max(1, Math.min(options.maxGeneratedFiles ?? 30, 100));
    this.maxGeneratedFileBytes = Math.max(1_000, Math.min(options.maxGeneratedFileBytes ?? 250_000, 1_000_000));
    this.tempRoot = path.resolve(options.tempRoot ?? os.tmpdir());
  }

  async prepare(task: AgentTask, files: GeneratedFile[]): Promise<SandboxWorkspace> {
    const configuredRoot = this.options.projectRoots[task.projectId];
    if (!configuredRoot) throw new Error('No trusted local checkout is configured for this project.');

    const configuredPath = path.resolve(configuredRoot);
    const configuredInfo = await lstat(configuredPath);
    if (!configuredInfo.isDirectory() || configuredInfo.isSymbolicLink()) {
      throw new Error('Configured project checkout must be a real directory, not a symlink.');
    }
    const sourceRoot = await realpath(configuredPath);
    const sourceInfo = await lstat(sourceRoot);
    if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
      throw new Error('Configured project checkout must be a real directory.');
    }

    const tempRootInfo = await lstat(this.tempRoot).catch(() => null);
    if (!tempRootInfo || !tempRootInfo.isDirectory() || tempRootInfo.isSymbolicLink()) {
      throw new Error('Sandbox temp root must exist and be a real directory.');
    }
    const workspacePath = await mkdtemp(path.join(this.tempRoot, 'agent-sandbox-'));
    let cleanupRequired = true;

    try {
      let copiedFiles = 0;
      let copiedBytes = 0;
      await this.copyDirectory(sourceRoot, workspacePath, sourceRoot, {
        addFile: (size: number) => {
          copiedFiles += 1;
          copiedBytes += size;
          if (copiedFiles > this.maxSourceFiles) throw new Error('Project checkout exceeds sandbox file-count limit.');
          if (copiedBytes > this.maxSourceBytes) throw new Error('Project checkout exceeds sandbox size limit.');
        },
      });

      if (files.length > this.maxGeneratedFiles) throw new Error('Generated file count exceeds sandbox limit.');
      const seen = new Set<string>();
      for (const file of files) {
        const relative = safeRelativePath(file.path);
        if (seen.has(relative)) throw new Error(`Duplicate generated path: ${relative}`);
        seen.add(relative);
        const destination = path.resolve(workspacePath, relative);
        if (!isWithin(workspacePath, destination)) throw new Error('Generated path escaped sandbox workspace.');
        const parent = path.dirname(destination);
        await mkdir(parent, { recursive: true });
        await this.assertNoSymlinkPath(workspacePath, parent);

        const existing = await lstat(destination).catch(() => null);
        if (file.operation === 'create') {
          if (existing) throw new Error(`Create operation would overwrite an existing file: ${relative}`);
          if (Buffer.byteLength(file.content, 'utf8') > this.maxGeneratedFileBytes) {
            throw new Error(`Generated file exceeds sandbox size limit: ${relative}`);
          }
          await writeFile(destination, file.content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        } else if (file.operation === 'update') {
          if (!existing || !existing.isFile() || existing.isSymbolicLink()) {
            throw new Error(`Update operation requires an existing regular file: ${relative}`);
          }
          if (Buffer.byteLength(file.content, 'utf8') > this.maxGeneratedFileBytes) {
            throw new Error(`Generated file exceeds sandbox size limit: ${relative}`);
          }
          await writeFile(destination, file.content, { encoding: 'utf8', flag: 'w', mode: 0o600 });
        } else if (file.operation === 'delete') {
          if (!existing || !existing.isFile() || existing.isSymbolicLink()) {
            throw new Error(`Delete operation requires an existing regular file: ${relative}`);
          }
          if (file.content !== '') throw new Error('Delete operation content must be empty.');
          await unlink(destination);
        } else {
          throw new Error(`Unsupported file operation: ${String(file.operation)}`);
        }
      }

      cleanupRequired = false;
      return {
        path: workspacePath,
        cleanup: async () => rm(workspacePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
      };
    } finally {
      if (cleanupRequired) await rm(workspacePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
    }
  }

  private async copyDirectory(
    source: string,
    destination: string,
    sourceRoot: string,
    limits: { addFile(size: number): void },
  ): Promise<void> {
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      if (excludedNames.has(entry.name) || excludedFilePatterns.some(pattern => pattern.test(entry.name))) continue;
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      if (!isWithin(sourceRoot, from)) throw new Error('Source checkout path escaped configured root.');
      const info = await lstat(from);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) {
        await mkdir(to, { recursive: true, mode: 0o700 });
        await this.copyDirectory(from, to, sourceRoot, limits);
      } else if (info.isFile()) {
        limits.addFile(info.size);
        await copyFile(from, to);
      }
    }
  }

  private async assertNoSymlinkPath(root: string, candidate: string): Promise<void> {
    const relative = path.relative(root, candidate);
    let current = root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error('Sandbox path contains a symlink or non-directory parent.');
      }
    }
  }
}
