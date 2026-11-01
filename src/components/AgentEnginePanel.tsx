import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  api,
  type AgentEngineProject,
  type AgentEngineTask,
  type AgentEngineTaskDetail,
  type AgentEngineTaskStatus,
} from '../services/api';

const statusStyles: Record<AgentEngineTaskStatus, string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-50 text-blue-700',
  validating: 'bg-violet-50 text-violet-700',
  awaiting_approval: 'bg-amber-50 text-amber-800',
  ready_to_propose: 'bg-indigo-50 text-indigo-700',
  proposing: 'bg-cyan-50 text-cyan-800',
  proposed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

function taskSummary(task: AgentEngineTask): string {
  if (!task.result || typeof task.result !== 'object') return '';
  const summary = (task.result as Record<string, unknown>).summary;
  return typeof summary === 'string' ? summary : '';
}

export const AgentEnginePanel: React.FC = () => {
  const [projects, setProjects] = useState<AgentEngineProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<AgentEngineTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgentEngineTaskDetail | null>(null);
  const [usage, setUsage] = useState<{ executions: number; inputTokens: number; outputTokens: number; estimatedCost: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newRepositoryUrl, setNewRepositoryUrl] = useState('');
  const [newDefaultBranch, setNewDefaultBranch] = useState('main');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('backend');
  const [targetFiles, setTargetFiles] = useState('src/example.ts');
  const [context, setContext] = useState('');
  const [mode, setMode] = useState<'approval' | 'autonomous'>('approval');

  const selectedProject = useMemo(
    () => projects.find(project => project.id === projectId) || null,
    [projects, projectId],
  );

  const loadProjects = useCallback(async () => {
    const rows = await api.agentEngineListProjects();
    setProjects(rows);
    setProjectId(current => current && rows.some(project => project.id === current) ? current : (rows[0]?.id || ''));
  }, []);

  const loadProjectData = useCallback(async (selectedId: string) => {
    if (!selectedId) {
      setTasks([]);
      setUsage(null);
      setSelectedTask(null);
      return;
    }
    const [taskRows, usageData] = await Promise.all([
      api.agentEngineListTasks(selectedId, { limit: 50 }),
      api.agentEngineGetUsage(selectedId),
    ]);
    setTasks(taskRows);
    setUsage(usageData);
    setSelectedTask(current => current && taskRows.some(task => task.id === current.task.id)
      ? current
      : null);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const rows = await api.agentEngineListProjects();
      setProjects(rows);
      const activeId = projectId && rows.some(project => project.id === projectId)
        ? projectId
        : (rows[0]?.id || '');
      setProjectId(activeId);
      if (activeId) await loadProjectData(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh Agent Engine data.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loadProjectData, projectId]);

  useEffect(() => {
    let active = true;
    api.agentEngineListProjects()
      .then(rows => {
        if (!active) return;
        setProjects(rows);
        setProjectId(current => current && rows.some(project => project.id === current) ? current : (rows[0]?.id || ''));
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load Agent Engine projects.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setTasks([]);
      setUsage(null);
      setSelectedTask(null);
      return;
    }
    Promise.all([
      api.agentEngineListTasks(projectId, { limit: 50 }),
      api.agentEngineGetUsage(projectId),
    ]).then(([taskRows, usageData]) => {
      if (!active) return;
      setTasks(taskRows);
      setUsage(usageData);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load project tasks.');
    });
    return () => { active = false; };
  }, [projectId]);

  const openTask = async (task: AgentEngineTask) => {
    setError('');
    try {
      const detail = await api.agentEngineGetTask(task.id);
      setSelectedTask(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load task details.');
    }
  };

  const refreshSelectedTask = async () => {
    if (!selectedTask) return;
    await openTask(selectedTask.task);
    if (projectId) await loadProjectData(projectId);
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const project = await api.agentEngineCreateProject({
        id: newProjectId.trim(),
        name: newProjectName.trim(),
        repositoryUrl: newRepositoryUrl.trim() || undefined,
        defaultBranch: newDefaultBranch.trim() || 'main',
      });
      const rows = await api.agentEngineListProjects();
      setProjects(rows);
      setProjectId(project.id);
      setNewProjectId('');
      setNewProjectName('');
      setNewRepositoryUrl('');
      setNewDefaultBranch('main');
      setShowProjectForm(false);
      setNotice('Project created. Configure its checkout, sandbox image and GitHub mapping on the worker before running tasks.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setBusy(false);
    }
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId) return;
    const paths = targetFiles.split('\n').map(file => file.trim()).filter(Boolean);
    if (paths.length === 0) {
      setError('Enter at least one target file path.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const task = await api.agentEngineCreateTask(projectId, {
        title: title.trim(),
        description: description.trim(),
        category,
        targetFiles: paths,
        context: context.trim() || undefined,
        mode,
      });
      setTitle('');
      setDescription('');
      setContext('');
      setTargetFiles('src/example.ts');
      await loadProjectData(projectId);
      await openTask(task);
      setNotice('Task queued. The dedicated worker will pick it up when its environment is online.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue task.');
    } finally {
      setBusy(false);
    }
  };

  const requestApproval = async () => {
    if (!selectedTask) return;
    setBusy(true);
    setError('');
    try {
      await api.agentEngineRequestApproval(selectedTask.task.id);
      await refreshSelectedTask();
      setNotice('Approval requested.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request approval.');
    } finally {
      setBusy(false);
    }
  };

  const decideApproval = async (decision: 'approved' | 'rejected') => {
    if (!selectedTask?.approval) return;
    setBusy(true);
    setError('');
    try {
      await api.agentEngineDecideApproval(selectedTask.approval.id, decision);
      await refreshSelectedTask();
      setNotice(decision === 'approved' ? 'Approval recorded. The worker can now create a draft PR.' : 'Task rejected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record approval.');
    } finally {
      setBusy(false);
    }
  };

  const createProposal = async () => {
    if (!selectedTask) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.agentEngineProposeTask(selectedTask.task.id);
      await refreshSelectedTask();
      setNotice(result.url ? `Draft pull request created: ${result.url}` : 'Draft pull request created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create GitHub proposal.');
    } finally {
      setBusy(false);
    }
  };

  const statusCounts = useMemo(() => ({
    active: tasks.filter(task => ['queued', 'running', 'validating', 'proposing'].includes(task.status)).length,
    approvals: tasks.filter(task => task.status === 'awaiting_approval').length,
    proposed: tasks.filter(task => task.status === 'proposed').length,
    failed: tasks.filter(task => task.status === 'failed').length,
  }), [tasks]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading Agent Engine...</div>;
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-black text-slate-900">AI Agent Engine</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Queue Gemini worker tasks, review validation, approve changes and create draft pull requests.</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700">{error}</div>}
      {notice && <div role="status" className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800">{notice}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: statusCounts.active, icon: Activity, style: 'text-blue-700 bg-blue-50' },
          { label: 'Awaiting approval', value: statusCounts.approvals, icon: ShieldCheck, style: 'text-amber-700 bg-amber-50' },
          { label: 'Draft PRs created', value: statusCounts.proposed, icon: CheckCircle2, style: 'text-emerald-700 bg-emerald-50' },
          { label: 'Failed', value: statusCounts.failed, icon: CircleAlert, style: 'text-rose-700 bg-rose-50' },
        ].map(card => {
          const Icon = card.icon;
          return <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.style}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 tabular-nums">{card.value}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{card.label}</div>
          </div>;
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)] gap-5">
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Project workspace</h3>
                <p className="text-[11px] text-slate-500 mt-1">Project IDs must match the worker's checkout, image and GitHub configuration.</p>
              </div>
              <button onClick={() => setShowProjectForm(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                <Plus className="w-3.5 h-3.5" /> Add project
              </button>
            </div>

            {showProjectForm && (
              <form onSubmit={createProject} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <label className="text-[11px] font-bold text-slate-600">Project ID
                  <input required pattern="[A-Za-z0-9_-]+" maxLength={100} value={newProjectId} onChange={e => setNewProjectId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="affiliateos" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">Display name
                  <input required maxLength={160} value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="AffiliateOS" />
                </label>
                <label className="text-[11px] font-bold text-slate-600 sm:col-span-2">Repository URL (reference only)
                  <input type="url" value={newRepositoryUrl} onChange={e => setNewRepositoryUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="https://github.com/owner/repository" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">Default branch
                  <input value={newDefaultBranch} onChange={e => setNewDefaultBranch(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" />
                </label>
                <div className="flex items-end justify-end gap-2">
                  <button type="button" onClick={() => setShowProjectForm(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Cancel</button>
                  <button type="submit" disabled={busy} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Create project</button>
                </div>
              </form>
            )}

            <div className="mt-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Active project</label>
              <select value={projectId} onChange={e => { setProjectId(e.target.value); setSelectedTask(null); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900" disabled={projects.length === 0}>
                {projects.length === 0 ? <option value="">No projects configured yet</option> : projects.map(project => <option key={project.id} value={project.id}>{project.name} ({project.id})</option>)}
              </select>
            </div>

            {selectedProject && usage && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black text-slate-900">{usage.executions}</div><div className="text-[10px] text-slate-500">Executions</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black text-slate-900">{usage.inputTokens.toLocaleString()}</div><div className="text-[10px] text-slate-500">Input tokens</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black text-slate-900">{usage.outputTokens.toLocaleString()}</div><div className="text-[10px] text-slate-500">Output tokens</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black text-slate-900">{usage.estimatedCost}</div><div className="text-[10px] text-slate-500">Estimated cost</div></div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="text-sm font-extrabold text-slate-900">Create agent task</h3>
            <p className="text-[11px] text-slate-500 mt-1">Tasks enter the Cloud SQL queue. The separate worker performs generation and sandbox validation.</p>
            <form onSubmit={createTask} className="mt-4 space-y-3">
              <label className="block text-[11px] font-bold text-slate-600">Task title
                <input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="Fix API validation bug" disabled={!projectId} />
              </label>
              <label className="block text-[11px] font-bold text-slate-600">Task description
                <textarea required maxLength={20000} rows={3} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="Describe the expected behavior and acceptance criteria..." disabled={!projectId} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-slate-600">Specialist
                  <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900">
                    <option value="backend">Backend</option><option value="frontend">Frontend</option><option value="database">Database</option><option value="security">Security</option><option value="testing">Testing</option><option value="code_review">Code review</option><option value="general">General</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold text-slate-600">Execution mode
                  <select value={mode} onChange={e => setMode(e.target.value as 'approval' | 'autonomous')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900">
                    <option value="approval">Human approval</option><option value="autonomous">Autonomous (server policy gated)</option>
                  </select>
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-600">Allowed target files (one per line)
                <textarea required rows={3} value={targetFiles} onChange={e => setTargetFiles(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900" placeholder="src/services/example.ts&#10;packages/agent-engine/index.ts" disabled={!projectId} />
              </label>
              <label className="block text-[11px] font-bold text-slate-600">Additional context (optional)
                <textarea rows={2} maxLength={20000} value={context} onChange={e => setContext(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900" placeholder="Relevant constraints, code paths, acceptance criteria..." disabled={!projectId} />
              </label>
              <div className="flex justify-end">
                <button type="submit" disabled={busy || !projectId} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold disabled:opacity-50">
                  <Bot className="w-4 h-4" /> Queue task
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div><h3 className="text-sm font-extrabold text-slate-900">Recent tasks</h3><p className="text-[11px] text-slate-500 mt-1">Latest 50 tasks for the selected project.</p></div>
              <button onClick={() => projectId && loadProjectData(projectId)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Reload</button>
            </div>
            {!projectId ? (
              <div className="py-10 text-center text-xs text-slate-400">Create a project to begin.</div>
            ) : tasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No tasks yet. Queue the first task.</div>
            ) : (
              <div className="mt-3 space-y-2 max-h-[540px] overflow-y-auto">
                {tasks.map(task => (
                  <button key={task.id} onClick={() => openTask(task)} className={`w-full text-left p-3 rounded-xl border transition ${selectedTask?.task.id === task.id ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{task.title}</span>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-extrabold ${statusStyles[task.status]}`}>{task.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span>{task.category}</span><span>·</span><span>{task.executionMode}</span><span>·</span><span>{new Date(task.createdAt).toLocaleString()}</span>
                    </div>
                    {taskSummary(task) && <p className="mt-2 text-[10px] text-slate-600 line-clamp-2">{taskSummary(task)}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTask && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-extrabold text-slate-900">Task details</h3><p className="text-[10px] text-slate-500 mt-1 font-mono">{selectedTask.task.id}</p></div>
                <button onClick={refreshSelectedTask} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh task"><RefreshCw className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">{selectedTask.task.title}</span>
                <span className={`px-2 py-1 rounded-full text-[9px] font-extrabold ${statusStyles[selectedTask.task.status]}`}>{selectedTask.task.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{selectedTask.task.description}</p>
              {taskSummary(selectedTask.task) && <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700">{taskSummary(selectedTask.task)}</div>}
              {selectedTask.task.errorMessage && <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-[11px] text-rose-700">{selectedTask.task.errorMessage}</div>}

              {selectedTask.validation && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    {selectedTask.validation.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                    Validation {selectedTask.validation.passed ? 'passed' : 'failed'}
                  </div>
                  <ul className="mt-2 space-y-1 text-[10px] text-slate-600">
                    {selectedTask.validation.checks.filter(check => !/^container output:/i.test(check)).map((check, index) => <li key={index}>• {check}</li>)}
                    {selectedTask.validation.findings.map((finding, index) => <li key={`finding-${index}`} className="text-rose-700">• {finding}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700">Changed files ({selectedTask.artifacts.length})</div>
                {selectedTask.artifacts.length === 0 ? <p className="text-[10px] text-slate-400">No generated artifacts saved.</p> : selectedTask.artifacts.map(file => (
                  <div key={file.path} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="truncate text-[10px] font-mono text-slate-700">{file.path}</span>
                    <span className="shrink-0 text-[9px] font-bold uppercase text-slate-500">{file.operation}</span>
                  </div>
                ))}
              </div>

              {selectedTask.approval && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-800">Approval</span><span className="text-[10px] font-extrabold uppercase text-slate-600">{selectedTask.approval.decision}</span></div>
                  {selectedTask.approval.comment && <p className="mt-2 text-[10px] text-slate-600">{selectedTask.approval.comment}</p>}
                  {selectedTask.approval.decision === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => decideApproval('approved')} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Approve</button>
                      <button onClick={() => decideApproval('rejected')} disabled={busy} className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
              )}

              {selectedTask.task.status === 'awaiting_approval' && !selectedTask.approval && (
                <button onClick={requestApproval} disabled={busy} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800 disabled:opacity-50">Request approval</button>
              )}

              {selectedTask.task.status === 'ready_to_propose' && (
                <button onClick={createProposal} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">
                  <ExternalLink className="w-3.5 h-3.5" /> Create draft GitHub PR
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Clock3 className="w-3.5 h-3.5" />
        The worker runs separately. If tasks remain queued, verify the worker service, Cloud SQL connection and per-project sandbox configuration.
      </div>
    </div>
  );
};
