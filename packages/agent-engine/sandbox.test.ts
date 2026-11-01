import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtemp, access, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DockerSandboxValidator } from './sandbox.ts';
import type { AgentTask, GeneratedFile } from './index.ts';

const task: AgentTask = {
  projectId: 'unknown-project',
  taskId: 'sandbox-config-test',
  title: 'Sandbox config test',
  description: 'Check per-project sandbox configuration.',
  category: 'backend',
  targetFiles: ['src/example.ts'],
  mode: 'approval',
};

const digestImage = `registry.example/agent-checks@sha256:${'a'.repeat(64)}`;

test('rejects sandbox images that are not pinned by SHA-256 digest', () => {
  assert.throws(
    () => new DockerSandboxValidator({ prepare: async () => ({ path: '/tmp', cleanup: async () => undefined }) }, { image: 'node:22-alpine' }),
    /pinned by sha256 digest/,
  );
});

test('fails closed when a project has no sandbox image and cleans its workspace', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-sandbox-config-test-'));
  let cleaned = false;
  try {
    const validator = new DockerSandboxValidator(
      {
        prepare: async (_task: AgentTask, _files: GeneratedFile[]) => ({
          path: root,
          cleanup: async () => { cleaned = true; await rm(root, { recursive: true, force: true }); },
        }),
      },
      { image: { affiliateos: digestImage } },
    );

    const report = await validator.validate([], task);
    assert.equal(report.passed, false);
    assert.match(report.findings[0], /No sandbox image is configured/);
    assert.equal(cleaned, true);
    await assert.rejects(access(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
