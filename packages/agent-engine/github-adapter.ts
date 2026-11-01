import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { GeneratedFile, IntegrationAdapter, ValidationReport } from './index.ts';

export interface GitHubProjectTarget {
  owner: string;
  repository: string;
  baseBranch: string;
}

export interface GitHubPullRequestAdapterOptions {
  /** GitHub App installation token or fine-grained token; keep server-side only. */
  token: string;
  /** Explicit server-owned project-to-repository mapping. Task input cannot select a repository. */
  projects: Record<string, GitHubProjectTarget>;
  /** Test seam. Production callers should omit this and use Node's built-in fetch. */
  fetchImpl?: typeof fetch;
}

interface GitHubRefResponse {
  object: { sha: string };
}

interface GitHubCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitHubBlobResponse {
  sha: string;
}

interface GitHubTreeResponse {
  sha: string;
}

interface GitHubPullResponse {
  number: number;
  html_url: string;
}

const API = 'https://api.github.com';
const allowedPrefixes = ['src/', 'tests/', 'packages/', 'migrations/', 'docs/'];
const blockedContent = [\n  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,\n  /\\bAIza[0-9A-Za-z_-]{30,}\\b/,\n  /\\bgh[pousr]_[A-Za-z0-9]{20,}\\b/,\n  /\\bsk-[A-Za-z0-9_-]{20,}\\b/,\n  /(api[_-]?key|client[_-]?secret|access[_-]?token)\\s*[:=]\\s*['\"][^'\"]{12,}['\"]/i,\n];\n\nconst blockedPath = [
  /(^|\\/)\\.env(?:\\.|$)/i,
  /(^|\\/)\\.git(?:\\/|$)/i,
  /(^|\\/)node_modules(?:\\/|$)/i,
  /(^|\\/)(package-lock\\.json|pnpm-lock\\.yaml|yarn\\.lock)$/i,
  /(^|\\/)(id_rsa|id_ed25519|credentials(?:\\.json)?|service-account(?:\\.json)?)$/i,
  /(^|\\/)(\\.npmrc|\\.netrc|\\.pypirc|\\.git-credentials)$/i,
  /(^|\\/)\\.(ssh|aws|docker|config)(\\/|$)/i,
  /\\.(pem|key|p12|pfx)$/i,
];

export function validateProposalFiles(files: GeneratedFile[]): void {
  if (!Array.isArray(files) || files.length < 1 || files.length > 30) {
    throw new Error('A pull request must contain between 1 and 30 generated files.');
  }

  const seen = new Set<string>();
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Generated file payload is invalid.');
    }
    const normalized = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
    const parts = normalized.split('/');
    if (
      !normalized ||
      normalized.startsWith('/') ||
      /^[A-Za-z]:/.test(normalized) ||
      parts.some(part => !part || part === '.' || part === '..' || /[\\u0000-\\u001f\\u007f]/.test(part)) ||
      !allowedPrefixes.some(prefix => normalized.startsWith(prefix)) ||
      blockedPath.some(pattern => pattern.test(normalized))
    ) {
      throw new Error(`Pull request policy rejected path: ${file.path}`);
    }
    if (seen.has(normalized)) throw new Error(`Duplicate pull request path: ${normalized}`);
    seen.add(normalized);
    if (!['create', 'update', 'delete'].includes(file.operation)) {
      throw new Error(`Unsupported file operation: ${String(file.operation)}`);
    }
    if (file.operation === 'delete' && file.content !== '') {
      throw new Error(`Delete operation must not include content: ${normalized}`);
    }
    if (file.operation !== 'delete' && !file.content) {
      throw new Error(`Empty generated file is not allowed: ${normalized}`);
    }
    if (blockedContent.some(pattern => pattern.test(file.content))) {\n      throw new Error(`Potential secret detected in generated file: ${normalized}`);\n    }\n    const size = Buffer.byteLength(file.content, 'utf8');
    if (size > 250_000) throw new Error(`Generated file exceeds size limit: ${normalized}`);
    totalBytes += size;
    if (totalBytes > 2_000_000) throw new Error('Pull request patch exceeds total size limit.');
  }
}

function validateTarget(target: GitHubProjectTarget): void {
  if (
    !/^[A-Za-z0-9_.-]{1,100}$/.test(target.owner) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(target.repository) ||
    !/^[A-Za-z0-9._/-]{1,150}$/.test(target.baseBranch) ||
    target.baseBranch.startsWith('/') ||
    target.baseBranch.includes('..')
  ) {
    throw new Error('Configured GitHub project target is invalid.');
  }
}

function safeTitle(summary: string): string {
  const oneLine = summary.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120);
  return `[AI Agent] ${oneLine || 'Validated code proposal'}`;
}

/**
 * Creates a branch, commit, and pull request only. It never merges, deploys, or pushes to the
 * configured base branch. Repository targets are selected exclusively from server configuration.
 */
export class GitHubPullRequestAdapter implements IntegrationAdapter {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GitHubPullRequestAdapterOptions) {
    if (!options.token || options.token.trim().length < 20) {
      throw new Error('A valid GitHub token is required for pull-request integration.');
    }
    if (!options.projects || typeof options.projects !== 'object' || Array.isArray(options.projects)) {
      throw new Error('A server-owned GitHub project mapping is required.');
    }
    for (const [projectId, target] of Object.entries(options.projects)) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(projectId)) throw new Error('GitHub project mapping contains an invalid project ID.');
      validateTarget(target);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async propose(input: {
    projectId: string;
    taskId: string;
    files: GeneratedFile[];
    summary: string;
    validation: ValidationReport;
  }): Promise<{ url?: string; reference?: string }> {
    if (!input.validation?.passed) {
      throw new Error('GitHub pull requests require a passing validation report.');
    }
    validateProposalFiles(input.files);

    const target = Object.hasOwn(this.options.projects, input.projectId) ? this.options.projects[input.projectId] : undefined;
    if (!target) throw new Error('No GitHub repository is configured for this project.');
    validateTarget(target);

    const repositoryPath = `/repos/${target.owner}/${target.repository}`;
    const baseRef = await this.request<GitHubRefResponse>(
      'GET',
      `${repositoryPath}/git/ref/heads/${encodeURIComponent(target.baseBranch)}`,
    );
    const baseCommit = await this.request<GitHubCommitResponse>(
      'GET',
      `${repositoryPath}/git/commits/${baseRef.object.sha}`,
    );

    const treeEntries: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string | null;
    }> = [];

    for (const file of input.files) {
      const normalized = file.path.replace(/\\/g, '/').replace(/^\.\//, '');
      if (file.operation === 'delete') {
        treeEntries.push({ path: normalized, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const blob = await this.request<GitHubBlobResponse>(
        'POST',
        `${repositoryPath}/git/blobs`,
        {
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      );
      treeEntries.push({ path: normalized, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await this.request<GitHubTreeResponse>(
      'POST',
      `${repositoryPath}/git/trees`,
      { base_tree: baseCommit.tree.sha, tree: treeEntries },
    );
    const summary = input.summary.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
    const commit = await this.request<GitHubCommitResponse>(
      'POST',
      `${repositoryPath}/git/commits`,
      {
        message: `Agent proposal: ${summary || input.taskId}`,
        tree: tree.sha,
        parents: [baseRef.object.sha],
      },
    );

    const branch = `agent/${input.taskId.replace(/[^A-Za-z0-9-]/g, '-').slice(0, 32) || 'task'}-${randomUUID().slice(0, 8)}`;
    await this.request(
      'POST',
      `${repositoryPath}/git/refs`,
      { ref: `refs/heads/${branch}`, sha: commit.sha },
    );

    const body = [
      '## Automated code proposal',
      '',
      summary || 'Validated code changes generated by the reusable agent engine.',
      '',
      `- Task: ${input.taskId}`,
      `- Validation: passed`,
      ...input.validation.checks.filter(check => !/^container output:/i.test(check)).slice(0, 20).map(check => `- Check: ${check.slice(0, 300)}`),
      '',
      'This pull request was created for review. It has not been merged or deployed.',
    ].join('\n');

    const pull = await this.request<GitHubPullResponse>(
      'POST',
      `${repositoryPath}/pulls`,
      {
        title: safeTitle(input.summary),
        head: branch,
        base: target.baseBranch,
        body,
        draft: true,
      },
    );
    return { url: pull.html_url, reference: branch };
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.fetchImpl(`${API}${endpoint}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.options.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      throw new Error(`GitHub API request failed (${response.status}): ${detail}`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }
}
