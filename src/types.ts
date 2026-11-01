export type CommissionType = 'percentage' | 'flat' | 'recurring' | 'unverified';

export type ProgramStatus = 'active' | 'needs_review' | 'paused' | 'expired' | 'draft' | 'manual_needed' | 'disabled';

export type HealthStatus = 'healthy' | 'warning' | 'broken' | 'down' | 'untested';

export interface ProgramSubLink {
  label: string;
  url: string;
}

export interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  logo_url: string;
  banner_url?: string;
  original_link: string;
  cloaked_slug: string;
  additional_links?: ProgramSubLink[];
  sort_order?: number;
  
  // Promotional & Referral Call-to-Action
  referral_perk?: string;    // e.g. "Exclusive: Free 14-Day Pro Trial + 20% Off"
  cta_label?: string;        // e.g. "Claim Deal & Try Free"
  
  // AI Generated Outputs
  ai_generated_pick: string; // e.g. "Editor's Pick — 4.9/5, best for AI devs"
  ai_description: string;    // 2-3 sentence marketing overview
  ai_brief: string;          // In-depth review, who it's for, why promote
  
  // Financial & Tracking
  commission_type: CommissionType;
  commission_value: string;  // e.g. "30%", "$150", "20% recurring"
  cookie_duration_days?: number;
  average_payout?: string;
  
  // Status & Health
  status: ProgramStatus;
  health_status: HealthStatus;
  last_http_code?: number;
  last_response_time_ms?: number;
  last_checked?: string;
  
  // Metadata
  key_selling_points: string[];
  target_audience: string;
  tags: string[];
  featured?: boolean;
  date_added: string;
  created_by?: string;
  manual_override_notes?: string;
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface ClickRecord {
  id: string;
  program_id: string;
  program_name: string;
  cloaked_slug: string;
  timestamp: string;
  ip_hash: string;
  user_agent: string;
  referrer_url: string;
  referrer_domain: string;
  destination_url?: string;
  device_type: DeviceType;
  browser?: string;
  country?: string;
}

export type UserRole = 'super_admin' | 'editor' | 'viewer';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash?: string;
  status?: 'active' | 'suspended';
  avatar_url?: string;
  last_login?: string;
}

export type NotificationChannel = 'email' | 'telegram' | 'webhook' | 'in_app';
export type NotificationSentStatus = 'sent' | 'failed' | 'queued' | 'simulated';

export interface NotificationLog {
  id: string;
  click_id?: string;
  program_id: string;
  program_name: string;
  channel: NotificationChannel;
  sent_status: NotificationSentStatus;
  timestamp: string;
  message: string;
  payload?: Record<string, any>;
}

export type RateLimitMode = 'instant' | 'digest_15m' | 'digest_hourly';

export interface NotificationSettings {
  enable_email: boolean;
  alert_email: string;
  // SMTP credentials for live email delivery
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_pass_set?: boolean;
  smtp_secure?: boolean;
  from_email?: string;
  enable_telegram?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  enable_webhook?: boolean;
  webhook_url?: string;
  rate_limit_mode: RateLimitMode;
  min_clicks_threshold?: number;
  alert_on_broken_link?: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ip_hash: string;
}

export interface VisitorSession {
  id: string;
  session_id: string;
  ip_hash: string;
  first_seen: string;
  last_seen: string;
  landing_page?: string;
  referrer?: string;
  device?: DeviceType;
}

export interface BulkImportItem {
  id: string;
  url: string;
  status: 'pending' | 'scraping' | 'analyzing' | 'completed' | 'failed';
  error?: string;
  program?: Partial<AffiliateProgram>;
}

export interface UserReview {
  id: string;
  program_id: string;
  program_name?: string;
  user_name: string;
  user_email?: string;
  rating: number; // 1 to 5
  title?: string;
  comment: string;
  timestamp: string;
  verified: boolean;
  status: 'approved' | 'pending' | 'rejected';
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  program_id?: string;
  timestamp: string;
  status: 'unread' | 'read';
}

export interface AnalyticsSummary {
  totalVisitors: number;
  totalClicks: number;
  uniqueClicks: number;
  clickThroughRate: number; // e.g. 24.5%
  todayVisitors: number;
  todayClicks: number;
  estimatedRevenue: number;
  healthyLinksCount: number;
  brokenLinksCount: number;
  topPrograms: {
    id: string;
    name: string;
    slug: string;
    clicks: number;
    commission_value: string;
    health_status: HealthStatus;
  }[];
  clicksOverTime: {
    date: string;
    label: string;
    clicks: number;
    visitors?: number;
  }[];
  referrerBreakdown: {
    domain: string;
    clicks: number;
    percentage: number;
  }[];
  deviceBreakdown: {
    device: DeviceType;
    clicks: number;
    percentage: number;
  }[];
}
