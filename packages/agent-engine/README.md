# Reusable Gemini AI Agent Engine

Reusable worker-agent foundation for AffiliateOS and future applications. Uses the application's existing Google Cloud SQL PostgreSQL pool; no second database is introduced.

## Included
- Specialized backend, frontend, database, security, testing and code-review roles.
- Gemini structured JSON generation, followed by Zod validation.
- Path allowlists, blocked-file rules, operation permissions, size limits and likely-secret scanning.
- Approval mode and policy-gated autonomous pull-request proposal interface.
- Cloud SQL persistence adapter with atomic task leasing, task history, artifacts, execution/usage records, validation results, approval decisions and audit events.
- Additive SQL migration in `migrations/0001_agent_engine.sql`.

## Connect existing Cloud SQL
```ts
import { pool } from '../../src/db/index.ts';
import { CloudSqlAgentRepository } from './repository.ts';

const repository = new CloudSqlAgentRepository(pool);
```
Pass the already configured application's `pg.Pool`; the repository does not create a pool. Run the migration once using the existing Cloud SQL deployment process before calling the repository.

## Queue worker lifecycle
1. `claimNextTask()` atomically leases one queued task using `FOR UPDATE SKIP LOCKED`.
2. Run Gemini through `AgentOrchestrator`.
3. Persist the worker result with `saveWorkerResult()`.
4. Execute structural and isolated sandbox checks; persist them using `saveValidation()`.
5. Create an approval with `requestApproval()`; an authorized reviewer decides with `decideApproval()`.
6. Approved tasks move to `ready_to_propose`; only then may a separately authorized integration adapter create a PR.

The application must enforce user authentication, project ownership and reviewer permissions before repository calls. This package does not implement an HTTP API, worker scheduler, sandbox or Git adapter yet.

## Safety
- Generated code is never executed in the API process.
- Autonomous PR creation is disabled by default and must not merge or deploy.
- Run tests and builds in an isolated, resource-limited sandbox with no production credentials and restricted network access.
- Treat model output and repository content as untrusted.
- Do not persist private chain-of-thought; store concise rationale and validation evidence.
- Configure database roles with least privilege. Restrict schema migration credentials separately from the runtime role.

## Environment
Node.js 20+, existing `@google/genai`, `zod`, and `pg` dependencies, plus `GEMINI_API_KEY`. Optional `AGENT_ENGINE_MODEL`.

## Remaining phases
Isolated Docker validator, GitHub PR adapter, authenticated Express endpoints, durable queue runner and admin dashboard. Local build, typecheck, automated tests and Cloud SQL migration have not yet been executed in this environment.
