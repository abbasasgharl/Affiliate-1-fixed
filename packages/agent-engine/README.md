# Reusable Gemini AI Agent Engine

Reusable worker-agent foundation for AffiliateOS and future applications. Uses the application's existing Google Cloud SQL PostgreSQL pool; no second database is introduced.

## Included
- Specialized backend, frontend, database, security, testing and code-review roles.
- Gemini structured JSON generation, followed by Zod validation.
- Path allowlists, blocked-file rules, operation permissions, size limits and likely-secret scanning.
- Approval mode and policy-gated autonomous pull-request proposal interface.
- Cloud SQL persistence adapter with atomic task leasing, task history, artifacts, execution/usage records, validation results, approval decisions and audit events.
- Docker-based isolated validation and a local trusted-checkout workspace provider.
- Additive SQL migrations in `migrations/`.

## Connect existing Cloud SQL
```ts
import { pool } from '../../src/db/index.ts';
import { CloudSqlAgentRepository } from './repository.ts';

const repository = new CloudSqlAgentRepository(pool);
```
Pass the already configured application's `pg.Pool`; the repository does not create a pool. Apply `0001_agent_engine.sql`, `0002_agent_engine_indexes.sql`, then `0003_agent_engine_proposal_state.sql` once through the existing Cloud SQL migration process.

## Queue worker lifecycle
1. Call `recoverStaleTasks()` on worker startup, then use `claimNextTask()` to atomically lease one queued task.
2. Run Gemini through `AgentOrchestrator`.
3. Persist generated files with `saveWorkerResult()`.
4. Validate through `DockerSandboxValidator`; persist results using `saveValidation()`.
5. Create an approval with `requestApproval()`; an authorized reviewer decides with `decideApproval()`.
6. Approved tasks move to `ready_to_propose`; a separately authorized integration adapter may then create a PR.

The application must enforce authentication, project ownership and reviewer permissions before repository calls. This package does not yet implement an HTTP API, durable queue scheduler, GitHub PR adapter or admin dashboard.

## Phase 3: isolated Docker validation

`DockerSandboxValidator` implements the engine's `validator.validate(files, task)` contract. It does not run code in the AffiliateOS API process. The included `LocalProjectWorkspaceProvider` creates a disposable copy of a trusted, pre-checked-out project directory and overlays the generated files.

Example wiring:

```ts
import { AgentOrchestrator } from './index.ts';
import { DockerSandboxValidator } from './sandbox.ts';
import { LocalProjectWorkspaceProvider } from './workspace-provider.ts';

const workspaces = new LocalProjectWorkspaceProvider({
  projectRoots: {
    affiliateos: process.env.AFFILIATEOS_CHECKOUT_PATH!,
  },
  tempRoot: '/var/tmp/agent-workspaces',
});

const validator = new DockerSandboxValidator(workspaces, {
  image: process.env.AGENT_SANDBOX_IMAGE!, // image@sha256:<64-hex digest>
  timeoutMs: 180_000,
  memoryMb: 1024,
  cpus: 1,
  pidsLimit: 128,
});

const orchestrator = new AgentOrchestrator({ validator });
```

The workspace provider accepts only project IDs mapped by server configuration; task input cannot select a filesystem path. It skips symlinks and credential/dependency/build directories, enforces source and generated-file limits, restricts generated paths, and removes the temporary workspace after validation.

The fixed container pipeline runs offline dependency installation with lifecycle scripts disabled, then the project's lint, build and test scripts when present. It uses `--network=none`, a read-only container root, dropped Linux capabilities, `no-new-privileges`, a non-root UID, bounded CPU/RAM/PIDs/time/output, and one disposable workspace bind mount. It accepts no task-provided shell commands, image names, environment variables or extra mounts. The sandbox image must be built for the target project from its root `package.json` and `package-lock.json`. The included `sandbox-image/Dockerfile` fetches dependencies during the trusted image-build stage, seeds an offline npm cache, and requires the Node base image to be supplied as a digest-pinned build argument. At runtime, `npm ci --offline` uses that cache; network access is intentionally unavailable during validation.

### Deployment boundary
- Run the queue worker and Docker daemon on a dedicated worker host or VM, separate from the AffiliateOS web/API process. Run the worker as UID/GID 10001 so the non-root container user can access its mode-0700 temporary workspace.
- Never mount `/var/run/docker.sock` into the API container. Docker daemon access is effectively host-level privilege.
- Build a project-specific image with `docker build -f packages/agent-engine/sandbox-image/Dockerfile --build-arg NODE_IMAGE=node:22-alpine@sha256:<verified-base-digest> -t <registry>/<project>-agent-sandbox:<version> .`; push it to a private registry and set `AGENT_SANDBOX_IMAGE` to the pushed image's immutable SHA-256 digest.
- Pin the sandbox image by digest and rebuild it through a trusted image pipeline.
- Configure `projectRoots` only with trusted local checkouts. The workspace provider is security-critical and must never copy credentials or production data.
- The sandbox requires a Docker daemon, a pinned image and a full project checkout before end-to-end validation can pass.


## Phase 4: GitHub pull-request adapter

`GitHubPullRequestAdapter` creates a dedicated branch, Git commit and **draft** pull request using the GitHub REST API. It never merges or deploys. Repository selection comes only from a server-owned `projects` map; a task cannot supply an owner, repository, branch or API URL.

Example configuration:

```ts
import { GitHubPullRequestAdapter } from './github-adapter.ts';

const integration = new GitHubPullRequestAdapter({
  token: process.env.AGENT_GITHUB_TOKEN!,
  projects: {
    affiliateos: {
      owner: 'YOUR_GITHUB_OWNER',
      repository: 'YOUR_REPOSITORY',
      baseBranch: 'main',
    },
  },
});
```

Use a GitHub App installation token or a fine-grained token restricted to the mapped repository with Contents read/write and Pull Requests read/write permissions. Store it only in the worker's secret manager as `AGENT_GITHUB_TOKEN`; never put it in Cloud SQL task context or pass it into the sandbox container.

The adapter independently checks proposal paths, blocked files, duplicate paths and patch sizes. It requires a passing validation report, creates a unique `agent/*` branch, commits the patch and opens a draft PR. Validation output is deliberately omitted from the PR body to avoid disclosing build logs. For approval mode, call the adapter only after the repository records an authorized approval; autonomous mode remains disabled unless explicitly enabled by server policy.

Unit tests cover unsafe paths, blocked lock/secret files, duplicate paths, size limits, validation gating and project mapping. The integration still needs a live GitHub App/token and a test repository to verify API permissions end-to-end.


## Phase 5: authenticated admin API

The server mounts `/api/agent-engine` using the existing AffiliateOS PostgreSQL pool and session authentication. All current endpoints are restricted to `super_admin` because the current project schema does not yet model per-project ownership or membership.

- `POST /api/agent-engine/projects` — create a project configuration.
- `POST /api/agent-engine/projects/:projectId/tasks` — enqueue a task in Cloud SQL (approval mode is the default).
- `GET /api/agent-engine/projects/:projectId/tasks` — list tasks with bounded limit, status and timestamp cursor.
- `GET /api/agent-engine/tasks/:taskId` — inspect task, artifact metadata and latest validation.
- `POST /api/agent-engine/tasks/:taskId/approval` — request approval after validation.
- `POST /api/agent-engine/approvals/:approvalId/decision` — approve or reject as a super administrator.
- `POST /api/agent-engine/tasks/:taskId/propose` — create a draft GitHub PR after approval and passing validation.
- `GET /api/agent-engine/projects/:projectId/usage` — read token and cost totals.

Proposal requests use a new `proposing` task state and an atomic Cloud SQL claim to prevent simultaneous requests from creating duplicate pull requests. Migration `0003_agent_engine_proposal_state.sql` adds that state. Apply it only after reviewing the SQL and through the existing Cloud SQL migration process; no migration has been run automatically.

Configure the GitHub integration using server-side secrets:
- `AGENT_GITHUB_TOKEN`: GitHub App installation token or fine-grained token.
- `AGENT_GITHUB_PROJECTS`: JSON object mapping each project ID to `{ "owner": "...", "repository": "...", "baseBranch": "main" }`.

The API process does not run generated code or start Docker. Task execution remains the responsibility of a separate worker process. Do not expose Docker socket or worker credentials to the web/API container.


## Phase 6: separate durable queue worker

The worker runs separately from the Express API, polls the existing Google Cloud SQL queue, leases tasks with `FOR UPDATE SKIP LOCKED`, runs Gemini, validates generated changes in Docker, persists artifacts/validation, and routes the task to approval or proposal. The API process never starts Docker or executes generated code.

Start it on the dedicated Linux worker host with:

```bash
npm ci
npm run agent-worker
```

Required worker environment (use a secret manager or a root-readable environment file; never commit secrets):

- `GEMINI_API_KEY`
- Existing Cloud SQL settings: `DATABASE_URL` or `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`
- `AGENT_PROJECT_ROOTS`: JSON map of project IDs to trusted local checkout paths, e.g. `{"affiliateos":"/opt/affiliateos"}`.
- `AGENT_SANDBOX_IMAGES`: JSON map of project IDs to private-registry image references pinned by SHA-256 digest.
- `AGENT_GITHUB_TOKEN` and `AGENT_GITHUB_PROJECTS` for proposal creation.
- Optional: `AGENT_ALLOW_AUTONOMOUS_PR=true` to permit autonomous draft PRs. Default is false; autonomous tasks then enter the human approval path.
- Optional resource/poll settings: `AGENT_WORKER_POLL_MS`, `AGENT_SANDBOX_TIMEOUT_MS`, `AGENT_SANDBOX_MEMORY_MB`, `AGENT_SANDBOX_CPUS`, `AGENT_SANDBOX_PIDS_LIMIT`, `AGENT_WORKSPACE_TEMP_ROOT`.

In production the worker enforces UID 10001. The worker user needs access to the Docker daemon on this dedicated VM (typically via the Docker group, which is effectively host-level privilege), but the API container must never receive Docker socket access. The included `deploy/agent-worker.service.example` is a hardened systemd starting point. Keep the project checkout read-only to the worker and make only the private workspace directory writable.

The worker requeues stale `running`/`validating` tasks after 15 minutes. A stale `proposing` task is marked failed with an explicit instruction to check GitHub before retrying; it is not automatically replayed because a PR may have been created immediately before a worker crash. Execution token counts/costs remain unknown unless a future Gemini usage-metadata integration supplies them.

This is a queue worker implementation, not a deployment. It still needs a dedicated VM, Docker, the Cloud SQL network path, trusted project checkouts, pinned images, secret configuration and a successful live smoke test.


## Phase 7: AffiliateOS admin dashboard

The super-admin Admin Portal now includes an **AI Agent Engine** tab. It uses the typed API client and the authenticated endpoints above to:
- Create/list projects and select the active project.
- Queue approval-mode or policy-gated autonomous tasks with target files and context.
- View task status, validation results, changed-file metadata, error messages and approval decisions.
- Approve/reject pending tasks and request a draft PR for approved work.
- View per-project execution and usage totals.

The UI tab is hidden from editors because the current API is super-admin-only. The dashboard does not execute code or connect to Docker. If a task remains queued, the worker service or its project-specific configuration is not available.

## Safety
- Generated code is never executed in the API process.
- Autonomous PR creation is disabled by default and must not merge or deploy.
- Treat model output and repository content as untrusted.
- Do not persist private chain-of-thought; store concise rationale and validation evidence.
- Configure database roles with least privilege. Restrict migration credentials separately from the runtime role.

## Environment
Node.js 20+, existing `@google/genai`, `zod`, and `pg` dependencies, plus `GEMINI_API_KEY`. Optional `AGENT_ENGINE_MODEL`.

## Remaining phases
Image publishing/registry configuration, live GitHub/Docker/Cloud SQL integration tests on the dedicated worker host, per-project authorization, UI/API integration tests and operational monitoring. The new GitHub Actions workflow will run workspace unit tests, TypeScript checks and the production build. Docker execution and Cloud SQL migrations still require the dedicated worker/Cloud SQL environment.
