# Agent Engine deployment runbook

This runbook is for a **separate Linux worker VM**. The AffiliateOS Express/API process must not receive Docker socket access and must never execute generated code.

## 1. Merge and migration order

The Agent Engine work is delivered as stacked draft pull requests: Phase 2 PR #3, Phase 3 PR #4, Phase 4 PR #5, Phases 5–7 PR #6, and Phase 8 PR #7. Review and merge in that order. After each base PR is merged, retarget the next PR's base branch to `main` before merging it (for example, after #3 lands, change #4's base from `feature/reusable-ai-agent-engine` to `main`; repeat for #5, #6 and #7). This keeps each merge incremental and avoids merging the same earlier phase twice. Do not merge a later stack until its base PR has landed and its CI/review feedback is resolved.

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

## 2. Provision the Hetzner worker VM

Create a dedicated Ubuntu 24.04 LTS Cloud server in the Hetzner Cloud Console. Start with an x86_64 instance with at least 2 vCPU and 4 GB RAM; sandbox builds may require more memory, so monitor Docker OOM events and resize if needed. Select a region only after checking latency to your Cloud SQL region. Confirm current prices in the [Hetzner Cloud price list](https://www.hetzner.com/cloud/); pricing and VAT vary by location and can change.

Add an SSH key at server creation. Do not enable password SSH. Restrict inbound SSH to your administrator IP/CIDR in the Hetzner firewall and host firewall; do not expose PostgreSQL port 5432 or Docker port 2375. This VM is dedicated to the worker, not the public API.

Upload `deploy/hetzner-worker-bootstrap.sh` and run it from a root SSH session, supplying your current trusted public IP/CIDR:

```bash
sudo ADMIN_CIDR='YOUR_ADMIN_PUBLIC_IP/32' bash deploy/hetzner-worker-bootstrap.sh
```

The script supports only Ubuntu 24.04, installs baseline packages and Docker, creates the worker account with UID 10001, and enables UFW/Fail2ban. Keep the original SSH session open and verify a second SSH login before closing it. Install Node.js 22 using the official Node.js distribution instructions, then verify `node --version` and `npm --version`.

Docker group membership is effectively host-root privilege. Keep this VM dedicated to the worker; never mount its Docker socket into the public API host/container. Check out the reviewed AffiliateOS release into `/opt/affiliateos`, make the checkout read-only to the worker, install locked dependencies, and ensure the worker can read the source tree:

```bash
cd /opt/affiliateos
npm ci
```

The worker writes only to its private systemd state directory, `/var/lib/affiliateos-agent-worker` (mode 0700).

## 3. Connect securely to the existing Google Cloud SQL database

Use the Google Cloud SQL Auth Proxy rather than opening Cloud SQL to the public internet or adding the Hetzner server as a broad authorized network. The proxy creates an authenticated, encrypted connection and listens locally on `127.0.0.1`; the database password is still required separately. See Google's [Cloud SQL Auth Proxy documentation](https://docs.cloud.google.com/sql/docs/postgres/sql-proxy).

In Google Cloud, enable the Cloud SQL Admin API and create a dedicated service account for this worker. Grant it only `roles/cloudsql.client` on the relevant project. Create/download its JSON key only if you accept the operational risk of a long-lived key on the external VM; store it outside the repository at `/etc/google/cloud-sql-proxy/service-account.json`, owned by `root:cloud-sql-proxy` with mode `0640`. Rotate/revoke it if exposed. A keyless external identity federation setup is preferable where your identity provider supports it.

Install the current Cloud SQL Auth Proxy v2 binary from Google's official download page, verify its published SHA-256 checksum, and install it as `/usr/local/bin/cloud-sql-proxy` owned by root and not writable by the service account. Copy `deploy/cloud-sql-proxy.env.example` to `/etc/affiliateos/cloud-sql-proxy.env`, set the real `PROJECT_ID:REGION:INSTANCE_NAME`, and set the credentials path. Install `deploy/cloud-sql-proxy.service.example` as `/etc/systemd/system/affiliateos-cloud-sql-proxy.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now affiliateos-cloud-sql-proxy
sudo systemctl status affiliateos-cloud-sql-proxy
```

Keep the proxy bound to `127.0.0.1:5432`. Set `SQL_HOST=127.0.0.1` and `SQL_PORT=5432` in the worker environment; do not set `DATABASE_URL` to a direct public Cloud SQL IP. Verify the worker's database user has only the required runtime DML permissions. Do not open port 5432 in either firewall.

## 4. Build and publish a sandbox image for each project

Authenticate Docker to the private registry first. Supply a **verified digest-pinned** Node base image and a versioned image tag:

```bash
NODE_IMAGE='node:22-alpine@sha256:<verified-64-character-digest>' \
IMAGE_TAG='registry.example.com/affiliateos-agent-checks:v1' \
bash deploy/build-agent-sandbox-image.sh
```

The script builds from the project root, performs dependency resolution at trusted image-build time, pushes the image and prints its immutable digest reference. Put that exact digest reference into `AGENT_SANDBOX_IMAGES`. Never use a floating tag in worker configuration.

## 5. Configure secrets and project mappings

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

Configure matching GitHub variables on the API server only if using the dashboard's direct **Create draft GitHub PR** action. The worker also needs them to process approved proposals. The Gemini key and Docker access belong only on the worker, not in the API container. Keep the Cloud SQL service-account key separate from the worker's .env file; the proxy service alone should be able to read it.

Keep `AGENT_ALLOW_AUTONOMOUS_PR=false initially. In this mode, even tasks submitted as autonomous require a human approval. Enable autonomous draft PR creation only after the approval flow and worker have been tested.

## 6. Validate configuration and start the service

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

## 7. Smoke-test the full workflow

1. Sign in to AffiliateOS as a `super_admin`.
2. Open Admin Portal → AI Agent Engine.
3. Create/select a project whose ID exists in `AGENT_PROJECT_ROOTS`, `AGENT_SANDBOX_IMAGES` and `AGENT_GITHUB_PROJECTS`.
4. Queue a low-risk task targeting a harmless file under an allowed path such as `src/`.
5. Confirm the worker logs show a task claim, Gemini result and Docker validation.
6. Confirm the task appears as awaiting approval with a passing validation report.
7. Approve it in the dashboard and confirm the worker creates a **draft** GitHub PR.
8. Confirm no merge or deployment occurred, and review the generated diff manually.

If the task remains queued, check Cloud SQL connectivity, worker logs, project ID mappings, Docker daemon access and sandbox image digest. If a task is marked failed with a proposal lease-expired message, inspect GitHub for a PR before attempting any retry; the worker intentionally does not replay an ambiguous PR operation.

## 8. Rollback

- Stop the worker: `sudo systemctl disable --now affiliateos-agent-worker`.
- Revoke the worker's GitHub token and Gemini key if compromised.
- Remove the worker VM's Docker group membership and access to Cloud SQL if no longer needed.
- Keep the additive database tables for investigation; do not drop them during an incident without reviewing audit/task history.
- The Agent Engine UI can be hidden by reverting the frontend/API release. Existing AffiliateOS features and database remain unchanged.

## Current readiness status

Code and configuration templates are committed in the feature branch. No worker VM has been provisioned, no image has been pushed, no secret has been configured, no Cloud SQL migration has been applied, and no live smoke test has been completed. Treat the system as **not production-ready** until all steps above pass.
