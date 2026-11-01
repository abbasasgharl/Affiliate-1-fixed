# Agent Engine deployment runbook

This runbook is for a **separate Linux worker VM**. The AffiliateOS Express/API process must not receive Docker socket access and must never execute generated code.

## 1. Merge and migration order

The Agent Engine work is delivered as stacked draft pull requests. Review and merge them in dependency order, resolving any CI/review feedback before moving to the next PR. Do not merge the later stack until its base PR has landed.

Before enabling the API or worker, review and apply these additive migrations to the existing Google Cloud SQL PostgreSQL database:

1. `packages/agent-engine/migrations/0001_agent_engine.sql`
2. `packages/agent-engine/migrations/0002_agent_engine_indexes.sql`
3. `packages/agent-engine/migrations/0003_agent_engine_proposal_state.sql`

Example using an authorized migration environment:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/agent-engine/migrations/0001_agent_engine.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/agent-engine/migrations/0002_agent_engine_indexes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/agent-engine/migrations/0003_agent_engine_proposal_state.sql
```

Use a migration role with schema/table DDL permissions. The runtime role should have only the DML permissions it needs. These migrations have **not** been run by this implementation.

## 2. Prepare the dedicated worker VM

Use a small Linux VM initially; scale only when queue volume requires it. Install Node.js 22, npm, Git, Docker Engine, Docker Buildx and the PostgreSQL client. Configure network access to the existing Cloud SQL instance (private IP or Cloud SQL Auth Proxy).

Create a dedicated worker account with UID 10001 and Docker daemon access:

```bash
sudo groupadd --system docker 2>/dev/null || true
sudo useradd --system --uid 10001 --home-dir /opt/agent-worker --create-home agent-worker
sudo usermod -aG docker agent-worker
```

Docker group membership is effectively host-level privilege. Keep this VM dedicated to the worker; do not reuse it as the public API host.

Check out the reviewed AffiliateOS release into `/opt/affiliateos`. Keep the checkout read-only to the worker, install locked dependencies, and ensure the worker can read the source tree:

```bash
cd /opt/affiliateos
npm ci
```

The worker writes only to its private systemd state directory. The example service creates `/var/lib/affiliateos-agent-worker` as a mode-0700 directory owned by the worker account.

## 3. Build and publish a sandbox image for each project

Authenticate Docker to the private registry first. Supply a **verified digest-pinned** Node base image and a versioned image tag:

```bash
NODE_IMAGE='node:22-alpine@sha256:<verified-64-character-digest>' \
IMAGE_TAG='registry.example.com/affiliateos-agent-checks:v1' \
bash deploy/build-agent-sandbox-image.sh
```

The script builds from the project root, performs dependency resolution at trusted image-build time, pushes the image and prints its immutable digest reference. Put that exact digest reference into `AGENT_SANDBOX_IMAGES`. Never use a floating tag in worker configuration.

## 4. Configure secrets and project mappings

Copy `deploy/agent-worker.env.example` to a secret-managed environment file, then replace every placeholder. Do not commit the real file.

Required:
- Existing Cloud SQL connection settings (`DATABASE_URL` or `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`).
- `GEMINI_API_KEY`.
- `AGENT_PROJECT_ROOTS`: project ID to trusted absolute checkout path.
- `AGENT_SANDBOX_IMAGES`: same project IDs to private image references pinned by digest.

For draft PR creation:
- `AGENT_GITHUB_TOKEN`: GitHub App installation token preferred; otherwise a fine-grained token scoped to the target repository.
- `AGENT_GITHUB_PROJECTS`: project ID to owner, repository and base branch.
- Grant only Contents read/write and Pull Requests read/write (plus repository metadata read).

Configure matching GitHub variables on the API server only if using the dashboard's direct **Create draft GitHub PR** action. The worker also needs them to process approved proposals. The Gemini key and Docker access belong only on the worker, not in the API container.

Keep `AGENT_ALLOW_AUTONOMOUS_PR=false initially. In this mode, even tasks submitted as autonomous require a human approval. Enable autonomous draft PR creation only after the approval flow and worker have been tested.

## 5. Validate configuration and start the service

Run the environment check as UID 10001 after loading the environment file:

```bash
sudo -u agent-worker bash -c 'set -a; source /etc/affiliateos/agent-worker.env; set +a; cd /opt/affiliateos; bash deploy/check-agent-worker-env.sh'
```

Install the service example:

```bash
sudo cp deploy/agent-worker.service.example /etc/systemd/system/affiliateos-agent-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now affiliateos-agent-worker
sudo systemctl status affiliateos-agent-worker
sudo journalctl -u affiliateos-agent-worker -f
```

Ensure the service account's UID is exactly 10001 and its Docker group can access the local daemon socket. The API host must not mount that socket.

## 6. Smoke-test the full workflow

1. Sign in to AffiliateOS as a `super_admin`.
2. Open Admin Portal → AI Agent Engine.
3. Create/select a project whose ID exists in `AGENT_PROJECT_ROOTS`, `AGENT_SANDBOX_IMAGES` and `AGENT_GITHUB_PROJECTS`.
4. Queue a low-risk task targeting a harmless file under an allowed path such as `src/`.
5. Confirm the worker logs show a task claim, Gemini result and Docker validation.
6. Confirm the task appears as awaiting approval with a passing validation report.
7. Approve it in the dashboard and confirm the worker creates a **draft** GitHub PR.
8. Confirm no merge or deployment occurred, and review the generated diff manually.

If the task remains queued, check Cloud SQL connectivity, worker logs, project ID mappings, Docker daemon access and sandbox image digest. If a task is marked failed with a proposal lease-expired message, inspect GitHub for a PR before attempting any retry; the worker intentionally does not replay an ambiguous PR operation.

## 7. Rollback

- Stop the worker: `sudo systemctl disable --now affiliateos-agent-worker`.
- Revoke the worker's GitHub token and Gemini key if compromised.
- Remove the worker VM's Docker group membership and access to Cloud SQL if no longer needed.
- Keep the additive database tables for investigation; do not drop them during an incident without reviewing audit/task history.
- The Agent Engine UI can be hidden by reverting the frontend/API release. Existing AffiliateOS features and database remain unchanged.

## Current readiness status

Code and configuration templates are committed in the feature branch. No worker VM has been provisioned, no image has been pushed, no secret has been configured, no Cloud SQL migration has been applied, and no live smoke test has been completed. Treat the system as **not production-ready** until all steps above pass.
