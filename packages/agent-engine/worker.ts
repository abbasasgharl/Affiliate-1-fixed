import 'dotenv/config';
import process from 'node:process';
import { pool } from '../../src/db/index.ts';
import { CloudSqlAgentRepository, type PersistedTask } from './repository.ts';
import { AgentOrchestrator, type AgentTask } from './index.ts';
import { DockerSandboxValidator } from './sandbox.ts';
import { LocalProjectWorkspaceProvider } from './workspace-provider.ts';
import { GitHubPullRequestAdapter, type GitHubProjectTarget } from './github-adapter.ts';

const env = process.env;
const MODEL = env.AGENT_ENGINE_MODEL || 'gemini-3.8-flash';

function parseJsonEnv<T>(name: string): T {
  const value = env[name];
  if (!value) throw new Error(`${name} is required.`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${name} must contain valid JSON.`);
  }
}

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

const projectRoots = parseJsonEnv<Record<string, string>>('AGENT_PROJECT_ROOTS');
const sandboxImages = parseJsonEnv<Record<string, string>>('AGENT_SANDBOX_IMAGES');
const workspaces = new LocalProjectWorkspaceProvider({
  projectRoots,
  tempRoot: env.AGENT_WORKSPACE_TEMP_ROOT || '/var/tmp/agent-workspaces',
});
const validator = new DockerSandboxValidator(workspaces, {
  image: sandboxImages,
  timeoutMs: boundedInteger('AGENT_SANDBOX_TIMEOUT_MS', 180_000, 10_000, 600_000),
  memoryMb: boundedInteger('AGENT_SANDBOX_MEMORY_MB', 1024, 256, 4096),
  cpus: Number(env.AGENT_SANDBOX_CPUS || 1),
  pidsLimit: boundedInteger('AGENT_SANDBOX_PIDS_LIMIT', 128, 32, 512),
});

const integration = (() => {
  const token = env.AGENT_GITHUB_TOKEN;
  const targetsJson = env.AGENT_GITHUB_PROJECTS;
  if (!token || !targetsJson) return undefined;
  const projects = parseJsonEnv<Record<string, GitHubProjectTarget>>('AGENT_GITHUB_PROJECTS');
  return new GitHubPullRequestAdapter({ token, projects });
})();

const repository = new CloudSqlAgentRepository(pool);
const orchestrator = new AgentOrchestrator({ validator, model: MODEL });
const allowAutonomous = env.AGENT_ALLOW_AUTONOMOUS_PR === 'true';
const pollMs = boundedInteger('AGENT_WORKER_POLL_MS', 3000, 1000, 60_000);
let stopping = false;
let lastRecoveryAt = 0;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function buildAgentTask(task: PersistedTask): AgentTask {
  const input = task.input && typeof task.input === 'object'
    ? task.input as Record<string, unknown>
    : {};
  if (!Array.isArray(input.targetFiles) || !input.targetFiles.every(file => typeof file === 'string')) {
    throw new Error('Persisted task has no valid targetFiles list.');
  }
  return {
    projectId: task.projectId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    category: task.category as AgentTask['category'],
    targetFiles: input.targetFiles as string[],
    context: typeof input.context === 'string' ? input.context : undefined,
    // Generation and validation are always separated from the later proposal step.
    mode: 'approval',
  };
}

async function executeTask(task: PersistedTask): Promise<void> {
  const startedAt = Date.now();
  const agentTask = buildAgentTask(task);
  const outcome = await orchestrator.execute(agentTask);
  const validation = 'validation' in outcome ? outcome.validation : undefined;
  const result = 'result' in outcome ? outcome.result : undefined;
  const errors = 'errors' in outcome ? outcome.errors : [];

  await repository.saveExecution({
    taskId: task.id,
    model: MODEL,
    status: outcome.status,
    durationMs: Date.now() - startedAt,
    metadata: { category: task.category, requestedMode: task.executionMode },
  });

  if (result) await repository.saveWorkerResult(task.id, result);
  if (validation) await repository.saveValidation(task.id, validation);

  if (validation?.passed) {
    if (task.executionMode === 'autonomous' && allowAutonomous && integration) {
      await repository.setTaskStatus(task.id, 'ready_to_propose');
      return;
    }
    await repository.requestApproval(task.id, task.requestedBy);
    return;
  }

  if (!validation) {
    await repository.setTaskStatus(
      task.id,
      'failed',
      errors.join('; ').slice(0, 4000) || 'Agent execution failed before validation.',
    );
  }
}

async function proposeApprovedTask(task: PersistedTask): Promise<void> {
  if (!integration) throw new Error('GitHub integration is not configured.');
  const validation = await repository.getLatestValidation(task.id);
  if (!validation?.passed) throw new Error('Approved task is missing a passing validation report.');
  const files = await repository.getArtifacts(task.id);
  if (files.length === 0) throw new Error('Approved task has no generated artifacts.');

  const savedResult = task.result && typeof task.result === 'object'
    ? task.result as Record<string, unknown>
    : {};
  const summary = typeof savedResult.summary === 'string' ? savedResult.summary : 'Validated agent changes';
  const pullRequest = await integration.propose({
    projectId: task.projectId,
    taskId: task.id,
    files,
    summary,
    validation,
  });
  await repository.setTaskStatus(task.id, 'proposed');
  process.stdout.write(`[AgentWorker] Draft PR created for task ${task.id}: ${pullRequest.url || pullRequest.reference || 'created'}\n`);
}

async function run(): Promise<void> {
  if (env.NODE_ENV === 'production' && process.getuid && process.getuid() !== 10001) {
    throw new Error('Production agent worker must run as UID 10001.');
  }
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required.');
  process.stdout.write('[AgentWorker] Started; polling Google Cloud SQL queue.\n');

  while (!stopping) {
    try {
      if (Date.now() - lastRecoveryAt > 60_000) {
        const recovered = await repository.recoverStaleTasks(900);
        if (recovered) process.stdout.write(`[AgentWorker] Recovered ${recovered} stale execution task(s).\n`);
        lastRecoveryAt = Date.now();
      }

      if (integration) {
        const proposalTask = await repository.claimNextProposalTask();
        if (proposalTask) {
          try {
            await proposeApprovedTask(proposalTask);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown GitHub proposal error.';
            await repository.setTaskStatus(proposalTask.id, 'failed', message.slice(0, 4000)).catch(() => undefined);
            console.error(`[AgentWorker] Proposal failed for task ${proposalTask.id}:`, message);
          }
          continue;
        }
      }

      const task = await repository.claimNextTask();
      if (!task) {
        await sleep(pollMs);
        continue;
      }

      process.stdout.write(`[AgentWorker] Claimed task ${task.id} (${task.category}).\n`);
      try {
        await executeTask(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown task execution error.';
        console.error(`[AgentWorker] Task ${task.id} failed:`, message);
        await repository.setTaskStatus(task.id, 'failed', message.slice(0, 4000)).catch(() => undefined);
      }
    } catch (error) {
      console.error('[AgentWorker] Queue loop error:', error);
      await sleep(Math.max(pollMs, 5000));
    }
  }
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

run()
  .catch(error => {
    console.error('[AgentWorker] Fatal startup error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
