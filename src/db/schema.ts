import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index
} from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID or system user ID
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  role: text('role').notNull().default('viewer'), // 'super_admin' | 'editor' | 'viewer'
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_role').on(table.role),
]);

// 2. Affiliate Programs Table
export const affiliatePrograms = pgTable('affiliate_programs', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  brandDomain: text('brand_domain').notNull(),
  affiliateUrl: text('affiliate_url').notNull(),
  destinationUrl: text('destination_url').notNull(),
  affiliateNetwork: text('affiliate_network'),
  commissionType: text('commission_type').default('unverified'),
  commissionValue: text('commission_value'),
  commissionStatus: text('commission_status').default('unverified'), // 'verified' | 'unverified'
  cookieDuration: text('cookie_duration'),
  referralPerk: text('referral_perk'),
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'expired' | 'disabled'
  featured: boolean('featured').default(false).notNull(),
  logoUrl: text('logo_url'),
  verificationStatus: text('verification_status').default('unverified').notNull(), // 'unverified' | 'pending' | 'verified' | 'expired'
  lastVerifiedAt: timestamp('last_verified_at'),
  healthStatus: text('health_status').default('healthy').notNull(), // 'healthy' | 'warning' | 'down' | 'unknown'
  lastHealthCheck: timestamp('last_health_check'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_programs_slug').on(table.slug),
  index('idx_programs_status').on(table.status),
  index('idx_programs_category').on(table.category),
]);

// 3. Clicks Table (Immutable real click events)
export const clicks = pgTable('clicks', {
  id: text('id').primaryKey(),
  programId: text('program_id').references(() => affiliatePrograms.id, { onDelete: 'cascade' }).notNull(),
  programName: text('program_name').notNull(),
  cloakedSlug: text('cloaked_slug').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  sessionId: text('session_id'),
  referrerDomain: text('referrer_domain'),
  userAgent: text('user_agent'),
  deviceType: text('device_type').default('unknown'), // 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser: text('browser'),
  os: text('os'),
  country: text('country'),
  ipHash: text('ip_hash').notNull(),
  destinationUrl: text('destination_url').notNull(),
  isPreview: boolean('is_preview').default(false).notNull(),
}, (table) => [
  index('idx_clicks_program_id').on(table.programId),
  index('idx_clicks_timestamp').on(table.timestamp),
  index('idx_clicks_session_id').on(table.sessionId),
]);

// 4. Visitor Sessions Table
export const visitorSessions = pgTable('visitor_sessions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  ipHash: text('ip_hash').notNull(),
  userAgent: text('user_agent'),
  pageViews: integer('page_views').default(1).notNull(),
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
}, (table) => [
  index('idx_visitor_sessions_session_id').on(table.sessionId),
  index('idx_visitor_sessions_first_seen').on(table.firstSeenAt),
]);

// 5. Reviews Table (Public users only see status = 'approved')
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  programId: text('program_id').references(() => affiliatePrograms.id, { onDelete: 'cascade' }).notNull(),
  userName: text('user_name').notNull(),
  userEmail: text('user_email'),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_reviews_program_id').on(table.programId),
  index('idx_reviews_status').on(table.status),
]);

// 6. Contact Messages Table
export const contactMessages = pgTable('contact_messages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('unread').notNull(), // 'unread' | 'read'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_contact_messages_created').on(table.createdAt),
  index('idx_contact_messages_status').on(table.status),
]);

// 7. Notification Settings Table
export const notificationSettings = pgTable('notification_settings', {
  id: text('id').primaryKey(),
  enableEmail: boolean('enable_email').default(true).notNull(),
  alertEmail: text('alert_email').default('').notNull(),
  rateLimitMode: text('rate_limit_mode').default('instant').notNull(), // 'instant' | 'digest_15m' | 'digest_hourly'
  smtpHost: text('smtp_host').default(''),
  smtpPort: integer('smtp_port').default(587).notNull(),
  smtpUser: text('smtp_user').default(''),
  smtpPass: text('smtp_pass').default(''),
  fromEmail: text('from_email').default(''),
  webhookUrl: text('webhook_url').default(''),
  enableWebhook: boolean('enable_webhook').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Notifications Log Table
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  channel: text('channel').notNull(),
  target: text('target').notNull(),
  status: text('status').notNull(), // 'delivered' | 'failed' | 'pending'
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_notifications_created').on(table.createdAt),
]);

// 9. Historical Health Checks Table
export const healthChecks = pgTable('health_checks', {
  id: text('id').primaryKey(),
  programId: text('program_id').references(() => affiliatePrograms.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  httpStatus: integer('http_status'),
  responseTimeMs: integer('response_time_ms'),
  healthStatus: text('health_status').notNull(), // 'healthy' | 'warning' | 'down'
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
}, (table) => [
  index('idx_health_checks_program_id').on(table.programId),
  index('idx_health_checks_checked_at').on(table.checkedAt),
]);

// 10. Audit Logs Table (Administrative accountability)
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  metadata: text('metadata'),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_created').on(table.createdAt),
  index('idx_audit_logs_user_id').on(table.userId),
]);

// 11. Server-Side Sessions Table (Secure revocation and invalidation)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // Session token / hash
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  userEmail: text('user_email').notNull(),
  role: text('role').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_expires_at').on(table.expiresAt),
]);

// Relations
export const affiliateProgramsRelations = relations(affiliatePrograms, ({ many }) => ({
  clicks: many(clicks),
  reviews: many(reviews),
  healthChecks: many(healthChecks),
}));

export const clicksRelations = relations(clicks, ({ one }) => ({
  program: one(affiliatePrograms, {
    fields: [clicks.programId],
    references: [affiliatePrograms.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  program: one(affiliatePrograms, {
    fields: [reviews.programId],
    references: [affiliatePrograms.id],
  }),
}));

export const healthChecksRelations = relations(healthChecks, ({ one }) => ({
  program: one(affiliatePrograms, {
    fields: [healthChecks.programId],
    references: [affiliatePrograms.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
