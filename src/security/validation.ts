import { z } from 'zod';

export const strongPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(200, 'Password is too long')
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), 'Password must include upper-case, lower-case and a number');

export const adminUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email('Valid email address is required'),
  role: z.enum(['super_admin', 'editor']).default('editor'),
  password: strongPassword,
});

export const visitorSchema = z.object({
  session_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export const setupSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  password: strongPassword,
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100).default('Admin Owner'),
  setup_token: z.string().min(1, 'Setup token is required'),
});

const normalizeUrl = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
};

const httpUrl = z.string().url('Valid URL is required').refine((u) => /^https?:\/\//i.test(u), 'Only http(s) URLs are allowed').refine((u) => u.length <= 2048, 'URL too long');

const subLinkSchema = z.object({
  label: z.string().trim().min(1, 'Link label is required'),
  url: z.preprocess(normalizeUrl, httpUrl)
});

export const programSchema = z.object({
  name: z.string().trim().min(1, 'Program name is required'),
  category: z.string().trim().min(1, 'Category is required').default('AI Tools'),
  brand_domain: z.string().trim().optional(),
  original_link: z.preprocess(normalizeUrl, httpUrl.optional()),
  affiliate_url: z.preprocess(normalizeUrl, httpUrl.optional()),
  destination_url: z.preprocess(normalizeUrl, httpUrl.optional()),
  cloaked_slug: z.string().trim().min(1, 'Cloaked slug is required').regex(/^[a-z0-9_-]+$/i, 'Slug must contain only letters, numbers, dashes, or underscores'),
  additional_links: z.array(subLinkSchema).max(2).optional().default([]),
  sort_order: z.number().int().optional(),
  referral_perk: z.string().trim().optional().default(''),
  description: z.string().trim().optional(),
  ai_generated_pick: z.string().trim().optional(),
  ai_description: z.string().trim().optional(),
  ai_brief: z.string().trim().optional(),
  cta_label: z.string().trim().optional(),
  commission_type: z.enum(['recurring', 'flat', 'percentage', 'unverified']).default('unverified'),
  commission_value: z.string().nullable().optional(),
  commission_status: z.enum(['verified', 'unverified']).default('unverified'),
  cookie_duration: z.string().nullable().optional(),
  cookie_duration_days: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'needs_review', 'paused', 'expired', 'draft', 'manual_needed', 'disabled']).default('active'),
  health_status: z.enum(['healthy', 'warning', 'broken', 'down', 'untested']).optional().default('healthy'),
  featured: z.boolean().optional().default(true),
  logo_url: httpUrl.or(z.literal('')).optional(),
  banner_url: httpUrl.or(z.literal('')).optional(),
  key_selling_points: z.array(z.string()).optional(),
  target_audience: z.string().optional(),
  tags: z.array(z.string()).optional(),
  manual_override_notes: z.string().optional(),
}).refine((data) => Boolean(data.original_link || data.affiliate_url), {
  message: 'A valid referral or destination link is required',
  path: ['original_link'],
});

export const programUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  brand_domain: z.string().trim().optional(),
  original_link: z.preprocess(normalizeUrl, httpUrl.optional()),
  affiliate_url: z.preprocess(normalizeUrl, httpUrl.optional()),
  destination_url: z.preprocess(normalizeUrl, httpUrl.optional()),
  cloaked_slug: z.string().trim().min(1).regex(/^[a-z0-9_-]+$/i).optional(),
  additional_links: z.array(subLinkSchema).max(2).optional(),
  sort_order: z.number().int().optional(),
  referral_perk: z.string().trim().optional(),
  description: z.string().trim().optional(),
  ai_generated_pick: z.string().trim().optional(),
  ai_description: z.string().trim().optional(),
  ai_brief: z.string().trim().optional(),
  cta_label: z.string().trim().optional(),
  commission_type: z.enum(['recurring', 'flat', 'percentage', 'unverified']).optional(),
  commission_value: z.string().nullable().optional(),
  commission_status: z.enum(['verified', 'unverified']).optional(),
  cookie_duration: z.string().nullable().optional(),
  cookie_duration_days: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'needs_review', 'paused', 'expired', 'draft', 'manual_needed', 'disabled']).optional(),
  health_status: z.enum(['healthy', 'warning', 'broken', 'down', 'untested']).optional(),
  last_http_code: z.number().optional(),
  last_response_time_ms: z.number().optional(),
  last_checked: z.string().optional(),
  featured: z.boolean().optional(),
  logo_url: httpUrl.or(z.literal('')).optional(),
  banner_url: httpUrl.or(z.literal('')).optional(),
  key_selling_points: z.array(z.string()).optional(),
  target_audience: z.string().optional(),
  tags: z.array(z.string()).optional(),
  manual_override_notes: z.string().optional(),
});

export const reviewSchema = z.object({
  program_id: z.string().trim().min(1, 'Program ID is required'),
  user_name: z.string().trim().min(2, 'Name must be 2-100 characters').max(100),
  user_email: z.string().trim().email('Valid email required').optional().or(z.literal('')),
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5),
  comment: z.string().trim().min(5, 'Review must be at least 5 characters').max(2000, 'Review cannot exceed 2000 characters'),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email address is required'),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000, 'Message cannot exceed 5000 characters'),
  program_id: z.string().optional(),
});

export const notificationSettingsSchema = z.object({
  enable_email: z.boolean().default(true),
  alert_email: z.string().trim().email('Valid alert recipient email required'),
  rate_limit_mode: z.enum(['instant', 'digest_15m', 'digest_hourly']).default('instant'),
  smtp_host: z.string().trim().optional().default(''),
  smtp_port: z.number().int().min(1).max(65535).default(587),
  smtp_user: z.string().trim().optional().default(''),
  smtp_pass: z.string().max(500).optional().default(''),
  from_email: z.string().trim().optional().default(''),
  webhook_url: z.union([httpUrl, z.literal('')]).optional().default(''),
  enable_webhook: z.boolean().default(false),
});
