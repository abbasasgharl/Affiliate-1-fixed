#!/usr/bin/env bash
set -euo pipefail

# Ubuntu 24.04 LTS baseline for a dedicated Agent Engine worker VM.
# Run as root on a fresh Hetzner Cloud server. This does not create a VM,
# configure Google Cloud IAM, install application secrets, or deploy the app.

fail() { echo "Bootstrap error: $1" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || fail "run as root"
[[ -r /etc/os-release ]] || fail "cannot identify operating system"
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] || fail "Ubuntu 24.04 LTS is required"

if [[ -z "${ADMIN_CIDR:-}" ]]; then
  fail "set ADMIN_CIDR to the trusted administrator IP/CIDR before enabling UFW (example: 203.0.113.10/32)"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git ufw fail2ban docker.io docker-buildx postgresql-client

# Dedicated worker identity. Docker group membership is host-root-equivalent;
# keep this VM dedicated to the worker and never mount its socket into the API.
if ! getent group docker >/dev/null; then groupadd --system docker; fi
if ! id agent-worker >/dev/null 2>&1; then
  useradd --system --uid 10001 --home-dir /opt/agent-worker --create-home --shell /usr/sbin/nologin agent-worker
fi
[[ "$(id -u agent-worker)" == "10001" ]] || fail "agent-worker already exists with an unexpected UID"
usermod -aG docker agent-worker
install -d -o agent-worker -g agent-worker -m 0700 /opt/agent-worker
install -d -o agent-worker -g agent-worker -m 0700 /var/lib/affiliateos-agent-worker
if ! id cloud-sql-proxy >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin cloud-sql-proxy
fi
install -d -o root -g root -m 0750 /etc/affiliateos
install -d -o root -g cloud-sql-proxy -m 0750 /etc/google/cloud-sql-proxy

systemctl enable --now docker
systemctl enable --now fail2ban

# Preserve SSH access only from the supplied administrator CIDR.
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
ufw --force enable

echo "Base host configured. Verify SSH access from the trusted IP before closing this session."
echo "Next: install Node.js 22, install and verify Cloud SQL Auth Proxy, configure service-account credentials,"
echo "configure /etc/affiliateos/*.env, build the digest-pinned sandbox image, then install systemd units."
