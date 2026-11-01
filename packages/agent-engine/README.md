# Reusable Gemini AI Agent Engine

Reusable worker-agent foundation for AffiliateOS and future applications. Uses the application's existing Google Cloud SQL PostgreSQL pool; no second database is introduced.

## Included
- Specialized backend, frontend, database, security, testing and code-review roles.
- Gemini structured JSON generation, followed by Zod validation.
- Path allowlists, blocked-file rules, operation permissions, size limits and likely-secret scanning.
- Approval mode and policy-gated autonomous pull-request proposal interface.
- Cloud SQL persistence adapter with atomic task leasing, task history, artifacts, execution/usage records, validation results, approval decisions and audit events.
- Additive SQL migrations in `migrations/`.

## Connect existing Cloud SQL
```ts
import { pool } from '../../src/db/index.ts';
import { CloudSqlAgentRepository } from './repository.ts';

const repository = new CloudSqlAgentRepository(pool);
```
Pass the already configured application's `pg.Pool`; the repository does not create a pool. Apply `0001_agent_engine.sql` then `0002_agent_engine_indexes.sql` once through the existing Cloud SQL migration process.

## Queue worker lifecycle
1. Call `recoverStaleTasks()` on worker startup to return expired running leases to the queue, then use `claimNextTask()` to atomically lease one queued task using `FOR UPDATE SKIP LOCKED`.
2. Run Gemini through `AgentOrchestrator`.
3. Persist generated files with `saveWorkerResult()`.
4. Run structural and isolated sandbox checks; persist results using `saveValidation()`.
5. Create an approval with `requestApproval()`; an authorized reviewer decides with `decideApproval()`.
6. Approved tasks move to `ready_to_propose`; a separately authorized integration adapter may then create a PR.

The task status helper enforces legal forward transitions. The application must enforce authentication, project ownership and reviewer permissions before repository calls. This package does not implement an HTTP API, worker scheduler, sandbox or Git adapter yet.


## Phase 3: isolated Docker validation

`DockerSandboxValidator` implements the engine's `validator.validate(files, task)` contract. It does not run code in the AffiliateOS API process. The validator delegates checkout creation and patch application to a `SandboxWorkspaceProvider`; that provider must create a disposable full-project workspace, safely overlay only the proposed files, reject traversal and symlinks, and exclude `.git`, `.env*`, credentials, production data and `node_modules`.

Example wiring (the workspace provider is an infrastructure adapter and must be implemented for the worker host):

```ts
import { AgentOrchestrator } from './index.ts';
import { DockerSandboxValidator } from './sandbox.ts';
import { LocalProjectWorkspaceProvider } from './workspace-provider.ts';

const validator = new DockerSandboxValidator(
  new LocalProjectWorkspaceProvider({\n    projectRoots: { affiliateos: process.env.AFFILIATEOS_CHECKOUT_PATH! },\n    tempRoot: '/var/tmp/agent-workspaces',\n  }),
  {
    image: process.env.AGENT_SANDBOX_IMAGE!, // must include @sha256:<64-hex digest>
    timeoutMs: 180_000,
    memoryMb: 1024,
    cpus: 1,
    pidsLimit: 128,
  },
);

const orchestrator = new AgentOrchestrator({ validator });
```

The fixed container pipeline runs offline dependency installation with lifecycle scripts disabled, then the project's lint, build and test scripts when present. It uses `--network=none`, a read-only container root, dropped Linux capabilities, `no-new-privileges`, a non-root UID, bounded CPU/RAM/PIDs/time/output, and only one disposable workspace bind mount. It accepts no task-provided shell commands, image names, environment variables or extra mounts. The sandbox image must be prebuilt with Node/npm and a populated npm cache for the project's dependency set; network access is intentionally unavailable during validation.

### Deployment boundary

- Run the queue worker and Docker daemon on a dedicated worker host or VM, separate from the AffiliateOS web/API process.
- Never mount `/var/run/docker.sock` into the API container. Docker daemon access is effectively host-level privilege.
- Pin the sandbox image by digest and rebuild it through a trusted image pipeline.
- The workspace provider is security-critical: it must copy from a trusted project checkout, enforce path and size limits, reject symlinks, and never include credentials or production data.
- This phase supplies the validator and security boundary. It does not yet provide a workspace provider, queue runner, Docker host, image build pipeline, or live deployment configuration.
- A Docker daemon, a pinned sandbox image, and a real project workspace are required before end-to-end validation can be marked as passed.

## Safety
- Generated code is never executed in the API process.
- Autonomous PR creation is disabled by default and must not merge or deploy.
- Run tests and builds in an isolated, resource-limited sandbox with no production credentials and restricted network access.
- Treat model output and repository content as untrusted.
- Do not persist private chain-of-thought; store concise rationale and validation evidence.
- Configure database roles with least privilege. Restrict migration credentials separately from the runtime role.

## Environment
Node.js 20+, existing `@google/genai`, `zod`, and `pg` dependencies, plus `GEMINI_API_KEY`. Optional `AGENT_ENGINE_MODEL`.

## Remaining phases
GitHub PR adapter, authenticated Express endpoints, durable queue runner, concrete workspace provider, sandbox image build/pinning pipeline and admin dashboard. Local build, typecheck, automated tests, Docker execution and Cloud SQL migrations have not yet been executed in this environment.
