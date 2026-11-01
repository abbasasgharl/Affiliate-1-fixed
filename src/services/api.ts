import {
  AffiliateProgram,
  ClickRecord,
  NotificationSettings,
  NotificationLog,
  AnalyticsSummary,
  HealthStatus,
  UserReview,
  AdminUser,
  ContactMessage,
  UserRole
} from '../types';

export interface AgentEngineProject {
  id: string;
  name: string;
  repositoryUrl: string | null;
  defaultBranch: string;
}

export type AgentEngineTaskStatus =
  | 'queued' | 'running' | 'validating' | 'awaiting_approval'
  | 'ready_to_propose' | 'proposing' | 'proposed' | 'failed' | 'cancelled';

export interface AgentEngineTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: string;
  executionMode: 'approval' | 'autonomous';
  status: AgentEngineTaskStatus;
  requestedBy: string | null;
  input: Record<string, unknown>;
  result: unknown;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentEngineTaskDetail {
  task: AgentEngineTask;
  artifacts: Array<{ path: string; operation: string }>;
  validation: { passed: boolean; checks: string[]; findings: string[] } | null;
  approval: {
    id: string;
    decision: 'pending' | 'approved' | 'rejected';
    requestedBy: string | null;
    decidedBy: string | null;
    comment: string | null;
    createdAt: string;
  } | null;
}

const ROLE_HINT_KEY = 'affiliateos_admin_role';

// Authentication uses an HttpOnly, SameSite=Strict session cookie set by the server.
// No token is ever stored in JavaScript-accessible storage.
function getAuthHeader(): Record<string, string> {
  return {};
}

function extractErrorMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.error === 'string') return data.error;
  if (data.error && typeof data.error.message === 'string') return data.error.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

export const api = {
  // Authentication APIs
  async login(email: string, password: string): Promise<{ user: AdminUser; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid email or password.');
    }
    localStorage.setItem(ROLE_HINT_KEY, data.user.role);
    return data;
  },

  async getSetupStatus(): Promise<{ setupRequired: boolean; ownerEmail?: string }> {
    try {
      const res = await fetch('/api/auth/setup-status');
      if (!res.ok) return { setupRequired: false };
      return await res.json();
    } catch {
      return { setupRequired: false };
    }
  },

  async setupAdmin(email: string, password: string, name?: string, setupToken?: string): Promise<{ user: AdminUser; token: string }> {
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, setup_token: setupToken })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Failed to complete initial admin setup.');
    }
    localStorage.setItem(ROLE_HINT_KEY, data.user.role);
    return data;
  },

  async getMe(): Promise<AdminUser | null> {
    if (!localStorage.getItem(ROLE_HINT_KEY)) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeader()
      });
      if (!res.ok) {
        localStorage.removeItem(ROLE_HINT_KEY);
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeader() });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(ROLE_HINT_KEY);
    }
  },

  // Programs APIs
  async getPrograms(): Promise<AffiliateProgram[]> {
    try {
      const res = await fetch('/api/programs');
      if (!res.ok) throw new Error('Failed to fetch programs');
      const data = await res.json();
      return data.programs;
    } catch (err) {
      console.error('Error fetching programs:', err);
      return [];
    }
  },

  async createProgram(programData: Partial<AffiliateProgram>): Promise<AffiliateProgram> {
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(programData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to create program'));
    return data.program;
  },

  async updateProgram(id: string, updates: Partial<AffiliateProgram>): Promise<AffiliateProgram> {
    const res = await fetch(`/api/programs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to update program'));
    return data.program;
  },

  async deleteProgram(id: string): Promise<string> {
    const res = await fetch(`/api/programs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to delete program'));
    return data.deletedId;
  },

  async reorderPrograms(orderedIds: string[]): Promise<AffiliateProgram[]> {
    const res = await fetch('/api/programs/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ orderedIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to reorder programs'));
    return data.programs;
  },

  async analyzeLinkWithAI(url: string): Promise<{
    program: Partial<AffiliateProgram>;
    botBlocked?: boolean;
    warning?: string;
  }> {
    const res = await fetch('/api/ai/analyze-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'AI Analysis failed'));
    return data;
  },

  async checkLinkHealth(options: { programId?: string; url?: string; checkAll?: boolean }): Promise<any> {
    const res = await fetch('/api/health/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(options)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Health check failed');
    return data;
  },

  // Clicks & Analytics APIs
  async getClicks(programId?: string, limit = 100): Promise<{ clicks: ClickRecord[]; total: number }> {
    try {
      const url = programId ? `/api/clicks?program_id=${programId}&limit=${limit}` : `/api/clicks?limit=${limit}`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch clicks');
      return await res.json();
    } catch {
      return { clicks: [], total: 0 };
    }
  },

  async clearClicks(): Promise<{ success: boolean; cleared: number; message: string }> {
    const res = await fetch('/api/clicks', {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to clear clicks');
    return data;
  },

  async trackClientClick(_programId: string): Promise<void> {
    // Section 12: Single authoritative tracking path is GET /go/:slug
    // Redundant client-side POST /api/clicks removed to avoid double counting
  },

  async getAnalytics(): Promise<AnalyticsSummary> {
    try {
      const res = await fetch('/api/analytics', { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return await res.json();
    } catch (err) {
      console.error('Error fetching analytics:', err);
      return {
        totalVisitors: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        clickThroughRate: 0,
        todayVisitors: 0,
        todayClicks: 0,
        estimatedRevenue: 0,
        healthyLinksCount: 0,
        brokenLinksCount: 0,
        topPrograms: [],
        clicksOverTime: [],
        referrerBreakdown: [],
        deviceBreakdown: []
      };
    }
  },

  // Notifications APIs
  async getNotificationConfig(): Promise<{ settings: NotificationSettings; history: NotificationLog[] }> {
    try {
      const res = await fetch('/api/notifications', { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch notification config');
      return await res.json();
    } catch {
      return {
        settings: {
          enable_email: true,
          alert_email: '',
          enable_telegram: false,
          telegram_bot_token: '',
          telegram_chat_id: '',
          enable_webhook: false,
          webhook_url: '',
          rate_limit_mode: 'instant',
          min_clicks_threshold: 1,
          alert_on_broken_link: true
        },
        history: []
      };
    }
  },

  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const res = await fetch('/api/notifications/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update notification settings');
    return data.settings;
  },

  async sendTestNotification(channel: string, test_email?: string): Promise<NotificationLog> {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ channel, test_email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch test notification');
    return data.notification;
  },

  async verifySmtp(settings: Partial<NotificationSettings>): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/notifications/verify-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(settings)
    });
    return await res.json();
  },

  // Visitor tracking
  async recordVisitor(): Promise<void> {
    try {
      await fetch('/api/visitors/record', { method: 'POST' });
    } catch {
      // ignore
    }
  },

  // User Reviews API
  async getReviews(programId?: string): Promise<UserReview[]> {
    try {
      const url = programId ? `/api/programs/${programId}/reviews` : '/api/reviews';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const data = await res.json();
      return data.reviews || [];
    } catch (err) {
      console.error('Error fetching reviews:', err);
      return [];
    }
  },

  async getAllReviews(): Promise<UserReview[]> {
    try {
      const res = await fetch('/api/reviews', { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch reviews for moderation');
      const data = await res.json();
      return data.reviews || [];
    } catch (err) {
      console.error('Error fetching admin reviews:', err);
      return [];
    }
  },

  async moderateReview(id: string, status: 'approved' | 'rejected' | 'pending', verified = false): Promise<boolean> {
    const res = await fetch(`/api/reviews/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status, verified })
    });
    const data = await res.json();
    return data.success;
  },

  async submitReview(reviewData: Partial<UserReview>): Promise<UserReview> {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit review');
    return data.review;
  },

  async deleteReview(id: string): Promise<void> {
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to delete review');
  },

  // Admin User Management API
  async getAdminUsers(): Promise<AdminUser[]> {
    try {
      const res = await fetch('/api/admin/users', { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch admin users');
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.error('Error fetching admin users:', err);
      return [];
    }
  },

  async createAdminUser(userData: { name: string; email: string; role: UserRole; password?: string }): Promise<AdminUser> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add admin user');
    return data.user;
  },

  async deleteAdminUser(id: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to revoke admin user');
  },

  // Contact Form & Inquiries API
  async getContactMessages(): Promise<ContactMessage[]> {
    try {
      const res = await fetch('/api/contact', { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed to fetch contact messages');
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  },

  async sendContactMessage(messageData: {
    name: string;
    email: string;
    subject: string;
    message: string;
    program_id?: string;
  }): Promise<ContactMessage> {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messageData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send message');
    return data.message;
  },

  async markMessageRead(id: string): Promise<void> {
    await fetch(`/api/contact/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
  },

  async deleteContactMessage(id: string): Promise<void> {
    const res = await fetch(`/api/contact/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete message');
  },

  async clearAllContactMessages(): Promise<void> {
    const res = await fetch('/api/contact', {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to clear all messages');
  }

  // Reusable Agent Engine APIs (super-admin control plane)
  async agentEngineListProjects(): Promise<AgentEngineProject[]> {
    const res = await fetch('/api/agent-engine/projects', { headers: getAuthHeader() });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to load agent projects'));
    return data.projects || [];
  },

  async agentEngineCreateProject(input: {
    id: string; name: string; repositoryUrl?: string; defaultBranch?: string;
  }): Promise<AgentEngineProject> {
    const res = await fetch('/api/agent-engine/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to create agent project'));
    return data.project;
  },

  async agentEngineCreateTask(projectId: string, input: {
    title: string; description: string; category: string;
    targetFiles: string[]; context?: string; mode: 'approval' | 'autonomous';
  }): Promise<AgentEngineTask> {
    const res = await fetch(`/api/agent-engine/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to queue agent task'));
    return data.task;
  },

  async agentEngineListTasks(projectId: string, filters: {
    limit?: number; status?: AgentEngineTaskStatus;
  } = {}): Promise<AgentEngineTask[]> {
    const query = new URLSearchParams();
    if (filters.limit) query.set('limit', String(filters.limit));
    if (filters.status) query.set('status', filters.status);
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const res = await fetch(`/api/agent-engine/projects/${encodeURIComponent(projectId)}/tasks${suffix}`, {
      headers: getAuthHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to load agent tasks'));
    return data.tasks || [];
  },

  async agentEngineGetTask(taskId: string): Promise<AgentEngineTaskDetail> {
    const res = await fetch(`/api/agent-engine/tasks/${encodeURIComponent(taskId)}`, {
      headers: getAuthHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to load agent task'));
    return data;
  },

  async agentEngineRequestApproval(taskId: string): Promise<{ id: string; decision: 'pending' }> {
    const res = await fetch(`/api/agent-engine/tasks/${encodeURIComponent(taskId)}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to request approval'));
    return data.approval;
  },

  async agentEngineDecideApproval(approvalId: string, decision: 'approved' | 'rejected', comment?: string): Promise<void> {
    const res = await fetch(`/api/agent-engine/approvals/${encodeURIComponent(approvalId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ decision, comment }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to record approval decision'));
  },

  async agentEngineProposeTask(taskId: string): Promise<{ url?: string; reference?: string }> {
    const res = await fetch(`/api/agent-engine/tasks/${encodeURIComponent(taskId)}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to create GitHub proposal'));
    return data.pullRequest;
  },

  async agentEngineGetUsage(projectId: string): Promise<{
    executions: number; inputTokens: number; outputTokens: number; estimatedCost: string;
  }> {
    const res = await fetch(`/api/agent-engine/projects/${encodeURIComponent(projectId)}/usage`, {
      headers: getAuthHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Failed to load agent usage'));
    return data.usage;
  },

};
