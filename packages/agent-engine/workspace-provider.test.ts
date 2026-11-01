import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, readdir, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalProjectWorkspaceProvider } from './workspace-provider.ts';
import type { AgentTask, GeneratedFile } from './index.ts';

const makeTask = (): AgentTask => ({
  projectId: 'affiliateos',
  taskId: 'sandbox-test',
  title: 'Workspace provider test',
  description: 'Exercise disposable workspace creation.',
  category: 'backend',
  targetFiles: ['src/example.ts', 'src/new.ts'],
  mode: 'approval',
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-workspace-test-'));
  const source = path.join(root, 'checkout');
  const temp = path.join(root, 'tmp');
  await mkdir(path.join(source, 'src'), { recursive: true });
  await mkdir(temp);
  await writeFile(path.join(source, 'src/example.ts'), 'export const value = 1;\n');
  await writeFile(path.join(source, '.env'), 'SHOULD_NOT_COPY=secret\n');
  await mkdir(path.join(source, '.git'));
  await writeFile(path.join(source, '.git/config'), '[core]\n');
  return { root, source, temp };
}

test('copies a trusted checkout, overlays changes, and cleans the workspace', async () => {
  const f = await fixture();
  try {
    const provider = new LocalProjectWorkspaceProvider({
      projectRoots: { affiliateos: f.source },
      tempRoot: f.temp,
    });
    const generated: GeneratedFile[] = [
      { path: 'src/example.ts', operation: 'update', content: 'export const value = 2;\n', rationale: 'update fixture' },
      { path: 'src/new.ts', operation: 'create', content: 'export const added = true;\n', rationale: 'create fixture' },
    ];
    const workspace = await provider.prepare(makeTask(), generated);
    assert.equal(await readFile(path.join(workspace.path, 'src/example.ts'), 'utf8'), 'export const value = 2;\n');
    assert.equal(await readFile(path.join(workspace.path, 'src/new.ts'), 'utf8'), 'export const added = true;\n');
    await assert.rejects(access(path.join(workspace.path, '.env')));
    await assert.rejects(access(path.join(workspace.path, '.git')));
    await workspace.cleanup();
    await assert.rejects(access(workspace.path));
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('rejects path traversal and removes a failed temporary workspace', async () => {
  const f = await fixture();
  try {
    const provider = new LocalProjectWorkspaceProvider({
      projectRoots: { affiliateos: f.source },
      tempRoot: f.temp,
    });
    await assert.rejects(
      provider.prepare(makeTask(), [{
        path: 'src/../../outside.ts',
        operation: 'create',
        content: 'not safe',
        rationale: 'malicious path',
      }]),
      /Workspace policy rejected path/,
    );
    const remaining = await readdir(f.temp);
    assert.deepEqual(remaining, []);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('rejects unconfigured project identifiers', async () => {
  const f = await fixture();
  try {
    const provider = new LocalProjectWorkspaceProvider({
      projectRoots: { affiliateos: f.source },
      tempRoot: f.temp,
    });
    await assert.rejects(
      provider.prepare({ ...makeTask(), projectId: '/etc' }, []),
      /No trusted local checkout/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
