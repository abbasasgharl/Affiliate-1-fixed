import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateProposalFiles, GitHubPullRequestAdapter } from './github-adapter.ts';
import type { GeneratedFile, ValidationReport } from './index.ts';

const validFile: GeneratedFile = {
  path: 'src/example.ts',
  operation: 'update',
  content: 'export const safe = true;\n',
  rationale: 'test patch',
};

const passed: ValidationReport = {
  passed: true,
  checks: ['TypeScript check passed', 'container output: sensitive build output must not enter PR body'],
  findings: [],
};

test('rejects traversal and sensitive paths in PR proposals', () => {
  assert.throws(() => validateProposalFiles([{ ...validFile, path: 'src/../../.env' }]), /policy rejected path/);
  assert.throws(() => validateProposalFiles([{ ...validFile, path: 'packages/agent-engine/package-lock.json' }]), /policy rejected path/);
  assert.throws(() => validateProposalFiles([{ ...validFile, path: 'src/.env.production' }]), /policy rejected path/);
});

test('rejects duplicate paths and oversized proposals', () => {
  assert.throws(() => validateProposalFiles([validFile, validFile]), /Duplicate pull request path/);
  assert.throws(() => validateProposalFiles([{ ...validFile, content: 'x'.repeat(250_001) }]), /exceeds size limit/);
});

test('requires passing validation and an explicitly configured project', async () => {
  let calls = 0;
  const adapter = new GitHubPullRequestAdapter({
    token: 'github_test_token_12345678901234567890',
    projects: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error('fetch must not be called for invalid input');
    },
  });

  await assert.rejects(
    adapter.propose({
      projectId: 'unknown',
      taskId: 'task-1',
      files: [validFile],
      summary: 'test',
      validation: { ...passed, passed: false },
    }),
    /require a passing validation/,
  );
  await assert.rejects(
    adapter.propose({
      projectId: 'unknown',
      taskId: 'task-1',
      files: [validFile],
      summary: 'test',
      validation: passed,
    }),
    /No GitHub repository is configured/,
  );
  assert.equal(calls, 0);
});
