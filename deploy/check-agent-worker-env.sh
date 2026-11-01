#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Agent worker configuration error: $1" >&2
  exit 1
}

for name in GEMINI_API_KEY AGENT_PROJECT_ROOTS AGENT_SANDBOX_IMAGES; do
  [[ -n "${!name:-}" ]] || fail "$name is required"
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  for name in SQL_HOST SQL_USER SQL_PASSWORD SQL_DB_NAME; do
    [[ -n "${!name:-}" ]] || fail "$name is required when DATABASE_URL is not set"
  done
fi

if [[ -n "${AGENT_GITHUB_TOKEN:-}" && -z "${AGENT_GITHUB_PROJECTS:-}" ]]; then
  fail "AGENT_GITHUB_PROJECTS is required when AGENT_GITHUB_TOKEN is set"
fi
if [[ -n "${AGENT_GITHUB_PROJECTS:-}" && -z "${AGENT_GITHUB_TOKEN:-}" ]]; then
  fail "AGENT_GITHUB_TOKEN is required when AGENT_GITHUB_PROJECTS is set"
fi

if [[ "${AGENT_ALLOW_AUTONOMOUS_PR:-false}" != "true" && "${AGENT_ALLOW_AUTONOMOUS_PR:-false}" != "false" ]]; then
  fail "AGENT_ALLOW_AUTONOMOUS_PR must be true or false"
fi

if [[ "${NODE_ENV:-production}" == "production" && "$(id -u)" != "10001" ]]; then
  fail "run this check as the dedicated agent-worker UID 10001"
fi

node --input-type=module <<'NODE'
import fs from 'node:fs';
const parseMap = (name) => {
  let value;
  try { value = JSON.parse(process.env[name] || ''); }
  catch { throw new Error(name + ' must be valid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(name + ' must be a JSON object');
  }
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key, item]) => !key || typeof item !== 'string' || !item.trim())) {
    throw new Error(name + ' must contain non-empty string values');
  }
  return Object.fromEntries(entries);
};

const roots = parseMap('AGENT_PROJECT_ROOTS');
const images = parseMap('AGENT_SANDBOX_IMAGES');
for (const [projectId, root] of Object.entries(roots)) {
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Project checkout must be a real directory: ' + projectId);
  if (!Object.hasOwn(images, projectId)) throw new Error('Missing sandbox image for project: ' + projectId);
}
for (const [projectId, image] of Object.entries(images)) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:@-]*@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('Sandbox image must be digest-pinned: ' + projectId);
  }
}

if (process.env.AGENT_GITHUB_PROJECTS) {
  let targets;
  try { targets = JSON.parse(process.env.AGENT_GITHUB_PROJECTS); }
  catch { throw new Error('AGENT_GITHUB_PROJECTS must be valid JSON'); }
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) throw new Error('AGENT_GITHUB_PROJECTS must be a JSON object');
  for (const [projectId, target] of Object.entries(targets)) {
    if (!Object.hasOwn(roots, projectId) || !target || typeof target !== 'object') {
      throw new Error('GitHub target must reference a configured project: ' + projectId);
    }
    if (![target.owner, target.repository, target.baseBranch].every(item => typeof item === 'string' && item.trim())) {
      throw new Error('GitHub target is incomplete: ' + projectId);
    }
  }
}
console.log('Agent worker configuration passed structural checks. Secret values were not displayed.');
NODE
