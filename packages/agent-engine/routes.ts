import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { IntegrationAdapter } from './index.ts';
import { requireAuth, requireRole } from '../../src/security/auth.ts';
import {
  CloudSqlAgentRepository,
  type PersistedTaskStatus,
} from './repository.ts';

const projectIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const taskIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);

const projectSchema = z.object({
  id: projectIdSchema,
  name: z.string().trim().min(1).max(160),
  repositoryUrl: z.string().url().max(500).nullable().optional(),
  defaultBranch: z.string().trim().min(1).max(150).regex(/^[A-Za-z0-9._/-]+$/).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
}).strict();

const allowedTargetPath = (value: string): boolean => {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = normalized.split('/');
  return Boolean(
    normalized &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized) &&
    !parts.some(part => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part)) &&
    ['src/', 'tests/', 'packages/', 'migrations/', 'docs/'].some(prefix => normalized.startsWith(prefix)) &&
    !/(^|\/)\.env(?:\.|$)|(^|\/)\.git(?:\/|$)|(^|\/)node_modules(?:\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(normalized)
  );
};

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  category: z.enum(['backend', 'frontend', 'database', 'security', 'testing', 'code_review', 'general']),
  targetFiles: z.array(z.string().min(1).max(500).refine(allowedTargetPath, 'Target path is not allowed.')).min(1).max(100),
  context: z.string().max(20_000).optional(),
  mode: z.enum(['approval', 'autonomous']).default('approval'),
}).strict();

const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2_000).optional(),
}).strict();

const statusValues: PersistedTaskStatus[] = [
  'queued', 'running', 'validating', 'awaiting_approval',
  'ready_to_propose', 'proposing', 'proposed', 'failed', 'cancelled',
];

const asyncRoute = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) => (req: Request, res: Response, next: NextFunction): void => {
  void handler(req, res, next).catch(next);
};

export interface AgentEngineRouterOptions {
  repository: CloudSqlAgentRepository;
  integration?: IntegrationAdapter;
}

/**
 * Admin-only control plane for the agent engine. Worker execution is deliberately not performed
 * inside the Express API process; these endpoints create and inspect durable Cloud SQL tasks.
 */
export function createAgentEngineRouter(options: AgentEngineRouterOptions) {
  const router = Router();
  const { repository, integration } = options;

  // Project ownership is not represented in the current schema, so restrict this control plane
  // to super administrators until per-project membership/ownership is implemented.
  router.use(requireAuth, requireRole('super_admin'));

  router.get('/projects', asyncRoute(async (_req, res) => {\n    const projects = await repository.listProjects();\n    return res.json({ success: true, projects });\n  }));\n\n  router.post('/projects', asyncRoute(async (req, res) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Invalid project.' },
      });
    }
    await repository.createProject(parsed.data);
    return res.status(201).json({ success: true, project: parsed.data });
  }));

  router.post('/projects/:projectId/tasks', asyncRoute(async (req, res) => {
    const projectId = projectIdSchema.safeParse(req.params.projectId);
    if (!projectId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project ID.' } });
    }
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Invalid task.' },
      });
    }

    const task = await repository.createTask({
      ...parsed.data,
      projectId: projectId.data,
      taskId: randomUUID(),
      requestedBy: req.user!.userId,
    });
    return res.status(202).json({ success: true, task });
  }));

  router.get('/projects/:projectId/tasks', asyncRoute(async (req, res) => {
    const projectId = projectIdSchema.safeParse(req.params.projectId);
    if (!projectId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project ID.' } });
    }

    const rawLimit = req.query.limit === undefined ? 25 : Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_LIMIT', message: 'Limit must be between 1 and 100.' } });
    }

    const status = req.query.status === undefined
      ? undefined
      : statusValues.includes(String(req.query.status) as PersistedTaskStatus)
        ? String(req.query.status) as PersistedTaskStatus
        : null;
    if (status === null) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Unknown task status.' } });
    }

    let before: Date | undefined;
    if (req.query.before !== undefined) {
      before = new Date(String(req.query.before));
      if (Number.isNaN(before.getTime())) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CURSOR', message: 'Invalid before timestamp.' } });
      }
    }

    const tasks = await repository.listTasks(projectId.data, { limit: rawLimit, before, status });
    return res.json({ success: true, tasks });
  }));

  router.get('/tasks/:taskId', asyncRoute(async (req, res) => {
    const taskId = taskIdSchema.safeParse(req.params.taskId);
    if (!taskId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID.' } });
    }
    const task = await repository.getTask(taskId.data);
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found.' } });
    const [artifacts, validation, approval] = await Promise.all([\n      repository.getArtifactMetadata(task.id),\n      repository.getLatestValidation(task.id),\n      repository.getLatestApproval(task.id),\n    ]);
    return res.json({
      success: true,
      task,
      artifacts: artifacts.map(file => ({
        path: file.path,
        operation: file.operation,
      })),
      validation,
    });
  }));

  router.post('/tasks/:taskId/approval', asyncRoute(async (req, res) => {
    const taskId = taskIdSchema.safeParse(req.params.taskId);
    if (!taskId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID.' } });
    }
    const approvalId = await repository.requestApproval(taskId.data, req.user!.userId);
    return res.status(201).json({ success: true, approval: { id: approvalId, decision: 'pending' } });
  }));

  router.post('/approvals/:approvalId/decision', asyncRoute(async (req, res) => {
    const approvalId = taskIdSchema.safeParse(req.params.approvalId);
    if (!approvalId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_APPROVAL_ID', message: 'Invalid approval ID.' } });
    }
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Invalid decision.' },
      });
    }
    await repository.decideApproval(
      approvalId.data,
      parsed.data.decision,
      req.user!.userId,
      parsed.data.comment,
    );
    return res.json({ success: true, approval: { id: approvalId.data, decision: parsed.data.decision } });
  }));

  router.post('/tasks/:taskId/propose', asyncRoute(async (req, res) => {
    const taskId = taskIdSchema.safeParse(req.params.taskId);
    if (!taskId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID.' } });
    }
    if (!integration) {
      return res.status(503).json({ success: false, error: { code: 'GITHUB_NOT_CONFIGURED', message: 'GitHub pull-request integration is not configured.' } });
    }

    const task = await repository.getTask(taskId.data);
    if (!task) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found.' } });
    if (task.status !== 'ready_to_propose') {
      return res.status(409).json({ success: false, error: { code: 'TASK_NOT_APPROVED', message: 'Task must be approved and ready to propose.' } });
    }
    const validation = await repository.getLatestValidation(task.id);
    if (!validation?.passed) {
      return res.status(409).json({ success: false, error: { code: 'VALIDATION_REQUIRED', message: 'A passing validation report is required.' } });
    }
    const files = await repository.getArtifacts(task.id);
    if (files.length === 0) {
      return res.status(409).json({ success: false, error: { code: 'NO_ARTIFACTS', message: 'No generated files are available for this task.' } });
    }

    const claimed = await repository.claimTaskForProposal(task.id, req.user!.userId);
    if (!claimed) {
      return res.status(409).json({ success: false, error: { code: 'PROPOSAL_ALREADY_CLAIMED', message: 'Another request is already processing this proposal.' } });
    }

    try {
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
      return res.status(201).json({ success: true, pullRequest });
    } catch (error) {
      await repository.setTaskStatus(
        task.id,
        'failed',
        error instanceof Error ? error.message.slice(0, 1000) : 'GitHub proposal failed; verify GitHub before retrying.',
      ).catch(() => undefined);
      throw error;
    }
  }));

  router.get('/projects/:projectId/usage', asyncRoute(async (req, res) => {
    const projectId = projectIdSchema.safeParse(req.params.projectId);
    if (!projectId.success) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PROJECT_ID', message: 'Invalid project ID.' } });
    }
    const usage = await repository.getUsageSummary(projectId.data);
    return res.json({ success: true, usage });
  }));

  return router;
}
