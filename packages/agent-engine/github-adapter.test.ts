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

test('creates a draft PR using only the server-mapped repository and omits container output', async () => {
  const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
  const adapter = new GitHubPullRequestAdapter({
    token: 'github_test_token_12345678901234567890',
    projects: {
      affiliateos: { owner: 'example-owner', repository: 'example-repo', baseBranch: 'main' },
    },
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      requests.push({ url, method, body });
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer github_test_token_12345678901234567890');
      let payload: Record<string, unknown> = {};
      if (url.endsWith('/git/ref/heads/main')) payload = { object: { sha: 'base-sha' } };
      else if (url.endsWith('/git/commits/base-sha')) payload = { sha: 'base-sha', tree: { sha: 'base-tree' } };
      else if (url.endsWith('/git/blobs')) payload = { sha: 'blob-sha' };
      else if (url.endsWith('/git/trees')) payload = { sha: 'tree-sha' };
      else if (url.endsWith('/git/commits')) payload = { sha: 'commit-sha', tree: { sha: 'tree-sha' } };
      else if (url.endsWith('/git/refs')) payload = { ref: 'refs/heads/agent/task-test-12345678' };
      else if (url.endsWith('/pulls')) payload = { number: 42, html_url: 'https://github.com/example-owner/example-repo/pull/42' };
      else throw new Error('Unexpected GitHub API endpoint: ' + url);
      return new Response(JSON.stringify(payload), {
        status: method === 'GET' ? 200 : 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await adapter.propose({
    projectId: 'affiliateos',
    taskId: 'task-test',
    files: [validFile],
    summary: 'Add a safe change',
    validation: passed,
  });

  assert.equal(result.url, 'https://github.com/example-owner/example-repo/pull/42');
  assert.equal(result.reference?.startsWith('agent/task-test-'), true);
  assert.equal(requests.length, 7);
  const pullRequest = requests.find(request => request.url.endsWith('/pulls'));
  assert.equal(pullRequest?.body?.draft, true);
  assert.equal(String(pullRequest?.body?.body).includes('sensitive build output'), false);
});
