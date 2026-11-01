import crypto from 'crypto';
import { encryptSecret, decryptSecret } from '../security/secrets.ts';
import { db } from './index.ts';
import {
  users,
  affiliatePrograms,
  clicks,
  visitorSessions,
  reviews,
  contactMessages,
  notificationSettings,
  notifications,
  auditLogs,
  healthChecks
} from './schema.ts';
import { eq, desc, and, or, sql, like, ilike } from 'drizzle-orm';
import type {
  AffiliateProgram,
  ClickRecord,
  AdminUser,
  NotificationSettings,
  NotificationLog,
  UserReview,
  ContactMessage,
  AuditLog,
  VisitorSession,
  AnalyticsSummary,
  DeviceType,
  HealthStatus
} from '../types.ts';
import {
  INITIAL_PROGRAMS,
  INITIAL_NOTIFICATION_SETTINGS
} from '../data/seedData.ts';

/**
 * Initializes PostgreSQL database state, seeding initial programs and settings if empty.
 * Never creates a hardcoded password in production.
 */
export async function initDatabase(): Promise<void> {
  console.log('[Database] Initializing PostgreSQL connection...');

  try {
    // 1. Ensure notification settings record exists
    const existingSettings = await db.select().from(notificationSettings).limit(1);
    if (existingSettings.length === 0) {
      console.log('[Database] Seeding initial notification settings in PostgreSQL...');
      await db.insert(notificationSettings).values({
        id: 'default',
        enableEmail: true,
        alertEmail: process.env.OWNER_EMAIL || '',
        rateLimitMode: 'instant',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
        fromEmail: '',
        webhookUrl: '',
        enableWebhook: false
      });
    }

    // 2. Ensure initial verified programs exist in PostgreSQL if table is empty
    const existingPrograms = await db.select({ id: affiliatePrograms.id }).from(affiliatePrograms).limit(1);
    if (existingPrograms.length === 0) {
      console.log('[Database] Seeding initial partner programs in PostgreSQL...');
      for (const p of INITIAL_PROGRAMS) {
        await db.insert(affiliatePrograms).values({
          id: p.id,
          slug: p.cloaked_slug,
          name: p.name,
          description: p.ai_description || p.ai_brief || '',
          category: p.category,
          brandDomain: new URL(p.original_link).hostname.replace(/^www\./, ''),
          affiliateUrl: p.original_link,
          destinationUrl: p.original_link,
          affiliateNetwork: 'Direct Partner',
          commissionType: p.commission_type || 'unverified',
          commissionValue: p.commission_value || null,
          commissionStatus: 'unverified',
          cookieDuration: p.cookie_duration_days ? `${p.cookie_duration_days} days` : null,
          referralPerk: p.referral_perk || null,
          // Sample programs are NOT published and NOT marked verified: review each one, replace the
          // placeholder link with your own approved affiliate link, then set the status to active.
          status: 'needs_review',
          featured: Boolean(p.featured),
          logoUrl: p.logo_url || null,
          verificationStatus: 'unverified',
          lastVerifiedAt: null,
          healthStatus: 'untested',
          lastHealthCheck: null
        }).onConflictDoNothing();
      }
    }

    const adminCheck = await hasAdminUser();
    if (!adminCheck) {
      console.log('[Database] No administrator registered yet. First-run secure setup is available.');
    } else {
      console.log('[Database] PostgreSQL database is ready with authoritative persistence.');
    }
  } catch (err: any) {
    console.error('[Database] Failed to initialize PostgreSQL:', err);
    throw err;
  }
}

/**
 * Checks whether an administrator account has been set up
 */
export async function hasAdminUser(): Promise<boolean> {
  const result = await db.select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(or(eq(users.role, 'super_admin'), eq(users.role, 'editor')));
  return (result[0]?.count || 0) > 0;
}

// -----------------------------------------------------------------------------
// POSTGRESQL AUTHORITATIVE DATABASE OPERATIONS
// -----------------------------------------------------------------------------
export const postgresDb = {
  // USER OPERATIONS
  async getUserByEmail(email: string): Promise<AdminUser | null> {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as AdminUser['role'],
      password_hash: u.passwordHash || undefined,
      status: u.status as any,
      last_login: u.lastLoginAt?.toISOString()
    };
  },

  async getUserById(id: string): Promise<AdminUser | null> {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as AdminUser['role'],
      password_hash: u.passwordHash || undefined,
      status: u.status as any,
      last_login: u.lastLoginAt?.toISOString()
    };
  },

  async getAllUsers(): Promise<AdminUser[]> {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as AdminUser['role'],
      status: u.status as any,
      last_login: u.lastLoginAt?.toISOString()
    }));
  },

  async createUser(data: {
    id?: string;
    uid?: string;
    name: string;
    email: string;
    role: AdminUser['role'];
    passwordHash?: string;
  }): Promise<AdminUser> {
    const id = data.id || `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanEmail = data.email.toLowerCase().trim();

    const [newUser] = await db.insert(users).values({
      id,
      uid: data.uid,
      name: data.name.trim(),
      email: cleanEmail,
      role: data.role,
      passwordHash: data.passwordHash,
      status: 'active',
      lastLoginAt: new Date(),
    }).returning();

    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as AdminUser['role'],
      status: newUser.status as any,
      last_login: newUser.lastLoginAt?.toISOString()
    };
  },

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
  },

  async updateUserRole(id: string, role: AdminUser['role']): Promise<void> {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  },

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user) return false;
    await db.delete(users).where(eq(users.id, id));
    return true;
  },

  // PROGRAM OPERATIONS
  async getPrograms(category?: string, search?: string): Promise<AffiliateProgram[]> {
    let conditions = [];
    if (category && category !== 'All') {
      conditions.push(eq(affiliatePrograms.category, category));
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(or(
        ilike(affiliatePrograms.name, q),
        ilike(affiliatePrograms.description, q),
        ilike(affiliatePrograms.category, q),
        ilike(affiliatePrograms.slug, q)
      ));
    }

    const rows = conditions.length > 0
      ? await db.select().from(affiliatePrograms).where(and(...conditions)).orderBy(desc(affiliatePrograms.createdAt))
      : await db.select().from(affiliatePrograms).orderBy(desc(affiliatePrograms.createdAt));

    const mapped = rows.map(r => this.mapRowToProgram(r));
    return mapped.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      const orderA = typeof a.sort_order === 'number' ? a.sort_order : 999999;
      const orderB = typeof b.sort_order === 'number' ? b.sort_order : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
    });
  },

  mapRowToProgram(r: typeof affiliatePrograms.$inferSelect): AffiliateProgram {
    let extraMeta: Record<string, any> = {};
    if (r.affiliateNetwork && r.affiliateNetwork.startsWith('{')) {
      try {
        extraMeta = JSON.parse(r.affiliateNetwork);
      } catch {
        extraMeta = {};
      }
    }

    const seedMatch = INITIAL_PROGRAMS.find(
      s => s.id === r.id || s.cloaked_slug.toLowerCase() === r.slug.toLowerCase()
    );

    const stripSubdomain = (d: string) => {
      const host = (d || '').toLowerCase().replace(/^www\./, '');
      const parts = host.split('.');
      const prefixes = new Set([
        'try', 'app', 'get', 'use', 'join', 'go', 'my', 'auth', 'login', 'signup',
        'dashboard', 'admin', 'portal', 'secure', 'cloud', 'partner', 'partners',
        'ref', 'aff', 'link', 'track', 'r', 'buy', 'shop', 'store', 'links', 'promo'
      ]);
      if (parts.length >= 3 && prefixes.has(parts[0])) {
        return parts.slice(1).join('.');
      }
      return host;
    };

    const rootDomain = stripSubdomain(r.brandDomain);
    let cleanLogo = r.logoUrl || seedMatch?.logo_url || `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
    if (cleanLogo.includes('google.com/s2/favicons?domain=')) {
      cleanLogo = `https://www.google.com/s2/favicons?domain=${rootDomain}&sz=128`;
    }

    return {
      id: r.id,
      name: r.name,
      category: r.category,
      logo_url: cleanLogo,
      banner_url: extraMeta.banner_url || seedMatch?.banner_url || undefined,
      original_link: r.affiliateUrl,
      cloaked_slug: r.slug,
      additional_links: Array.isArray(extraMeta.additional_links) ? extraMeta.additional_links : [],
      sort_order: typeof extraMeta.sort_order === 'number' ? extraMeta.sort_order : undefined,
      referral_perk: r.referralPerk || extraMeta.referral_perk || seedMatch?.referral_perk || '',
      cta_label: extraMeta.cta_label || seedMatch?.cta_label || `Claim ${r.name} Deal`,
      ai_generated_pick: extraMeta.ai_generated_pick || seedMatch?.ai_generated_pick || r.description,
      ai_description: extraMeta.ai_description || r.description,
      ai_brief: extraMeta.ai_brief || seedMatch?.ai_brief || r.description,
      commission_type: (r.commissionType as any) || 'unverified',
      commission_value: r.commissionValue || 'Not verified',
      cookie_duration_days: r.cookieDuration ? parseInt(r.cookieDuration, 10) || 60 : 60,
      status: (r.status as any) || 'active',
      health_status: (r.healthStatus as any) || 'healthy',
      last_http_code: extraMeta.last_http_code || 200,
      last_checked: r.lastHealthCheck?.toISOString() || new Date().toISOString(),
      key_selling_points: Array.isArray(extraMeta.key_selling_points) && extraMeta.key_selling_points.length > 0
        ? extraMeta.key_selling_points
        : seedMatch?.key_selling_points || [
            'Direct verified partner connection',
            'Transparent referral disclosure',
            'Continuous uptime & link monitoring'
          ],
      target_audience: extraMeta.target_audience || seedMatch?.target_audience || 'Modern businesses, developers, and tech professionals',
      tags: Array.isArray(extraMeta.tags) && extraMeta.tags.length > 0
        ? extraMeta.tags
        : seedMatch?.tags || [r.category, r.name],
      featured: r.featured,
      date_added: r.createdAt.toISOString()
    };
  },

  async getProgramById(id: string): Promise<AffiliateProgram | null> {
    const rows = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.id, id)).limit(1);
    if (rows.length === 0) return null;
    return this.mapRowToProgram(rows[0]);
  },

  async getProgramBySlug(slug: string): Promise<AffiliateProgram | null> {
    const cleanSlug = slug.toLowerCase().trim();
    const rows = await db.select().from(affiliatePrograms).where(eq(affiliatePrograms.slug, cleanSlug)).limit(1);
    if (rows.length === 0) return null;
    return this.mapRowToProgram(rows[0]);
  },

  async createProgram(program: AffiliateProgram): Promise<AffiliateProgram> {
    let baseSlug = (program.cloaked_slug || program.name || 'deal')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'deal';

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await db.select({ id: affiliatePrograms.id }).from(affiliatePrograms).where(eq(affiliatePrograms.slug, slug)).limit(1);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    let brandDomain = 'partner.io';
    try {
      brandDomain = new URL(program.original_link).hostname.replace(/^www\./, '');
    } catch {}

    const id = program.id || `prog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const extraMeta = JSON.stringify({
      banner_url: program.banner_url || '',
      cta_label: program.cta_label || `Try ${program.name.trim()} Free`,
      ai_generated_pick: program.ai_generated_pick || `Recommended Partner — ${program.name.trim()}`,
      ai_description: program.ai_description || program.ai_brief || `${program.name.trim()} partner referral program.`,
      ai_brief: program.ai_brief || program.ai_description || '',
      key_selling_points: program.key_selling_points || [],
      target_audience: program.target_audience || 'Modern teams, creators, and professionals',
      tags: program.tags || [program.category || 'AI Tools', program.name.trim()],
      additional_links: Array.isArray(program.additional_links) ? program.additional_links.slice(0, 2) : [],
      sort_order: typeof program.sort_order === 'number' ? program.sort_order : 0
    });

    await db.insert(affiliatePrograms).values({
      id,
      slug,
      name: program.name.trim(),
      description: program.ai_description || program.ai_brief || program.ai_generated_pick || `${program.name.trim()} partner referral program.`,
      category: program.category || 'AI Tools',
      brandDomain,
      affiliateUrl: program.original_link,
      destinationUrl: program.original_link,
      affiliateNetwork: extraMeta,
      commissionType: program.commission_type || 'unverified',
      commissionValue: program.commission_value || null,
      commissionStatus: 'unverified', // only a human can mark commission terms as verified
      cookieDuration: program.cookie_duration_days ? `${program.cookie_duration_days} days` : null,
      referralPerk: program.referral_perk || null,
      status: program.status || 'active',
      featured: program.featured !== undefined ? Boolean(program.featured) : true,
      logoUrl: program.logo_url || `https://www.google.com/s2/favicons?domain=${brandDomain}&sz=128`,
      verificationStatus: 'unverified',
      lastVerifiedAt: null,
      healthStatus: program.health_status || 'untested',
      lastHealthCheck: null
    });

    const created = await this.getProgramById(id);
    return created!;
  },

  async updateProgram(id: string, updates: Partial<AffiliateProgram>): Promise<AffiliateProgram> {
    const existing = await this.getProgramById(id);
    if (!existing) throw new Error('Program not found');

    if (updates.cloaked_slug && updates.cloaked_slug !== existing.cloaked_slug) {
      const slugConflict = await db.select({ id: affiliatePrograms.id })
        .from(affiliatePrograms)
        .where(and(eq(affiliatePrograms.slug, updates.cloaked_slug.toLowerCase().trim()), sql`${affiliatePrograms.id} != ${id}`))
        .limit(1);
      if (slugConflict.length > 0) {
        throw new Error(`Slug "${updates.cloaked_slug}" is already in use.`);
      }
    }

    const mergedMeta = JSON.stringify({
      banner_url: updates.banner_url !== undefined ? updates.banner_url : existing.banner_url,
      cta_label: updates.cta_label !== undefined ? updates.cta_label : existing.cta_label,
      ai_generated_pick: updates.ai_generated_pick !== undefined ? updates.ai_generated_pick : existing.ai_generated_pick,
      ai_description: updates.ai_description !== undefined ? updates.ai_description : existing.ai_description,
      ai_brief: updates.ai_brief !== undefined ? updates.ai_brief : existing.ai_brief,
      key_selling_points: updates.key_selling_points !== undefined ? updates.key_selling_points : existing.key_selling_points,
      target_audience: updates.target_audience !== undefined ? updates.target_audience : existing.target_audience,
      tags: updates.tags !== undefined ? updates.tags : existing.tags,
      additional_links: updates.additional_links !== undefined ? updates.additional_links : (existing.additional_links || []),
      sort_order: updates.sort_order !== undefined ? updates.sort_order : existing.sort_order
    });

    const setValues: Record<string, any> = {
      updatedAt: new Date(),
      affiliateNetwork: mergedMeta
    };
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.category !== undefined) setValues.category = updates.category;
    if (updates.cloaked_slug !== undefined) setValues.slug = updates.cloaked_slug.toLowerCase().trim();
    if (updates.original_link !== undefined) {
      setValues.affiliateUrl = updates.original_link;
      setValues.destinationUrl = updates.original_link;
    }
    if (updates.referral_perk !== undefined) setValues.referralPerk = updates.referral_perk;
    if (updates.ai_description !== undefined) setValues.description = updates.ai_description;
    if (updates.commission_type !== undefined) setValues.commissionType = updates.commission_type;
    if (updates.commission_value !== undefined) setValues.commissionValue = updates.commission_value;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.featured !== undefined) setValues.featured = updates.featured;
    if (updates.health_status !== undefined) setValues.healthStatus = updates.health_status;
    if (updates.logo_url !== undefined) setValues.logoUrl = updates.logo_url;

    await db.update(affiliatePrograms).set(setValues).where(eq(affiliatePrograms.id, id));
    const updated = await this.getProgramById(id);
    return updated!;
  },

  async reorderPrograms(orderedIds: string[]): Promise<AffiliateProgram[]> {
    const allPrograms = await this.getPrograms();
    const mapById = new Map(allPrograms.map(p => [p.id, p]));
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (mapById.has(id)) {
        await this.updateProgram(id, { sort_order: i + 1 });
      }
    }
    return this.getPrograms();
  },

  async deleteProgram(id: string): Promise<boolean> {
    const res = await db.delete(affiliatePrograms).where(eq(affiliatePrograms.id, id)).returning({ id: affiliatePrograms.id });
    return res.length > 0;
  },

  // CLICK OPERATIONS
  async recordClick(click: ClickRecord): Promise<void> {
    await db.insert(clicks).values({
      id: click.id,
      programId: click.program_id,
      programName: click.program_name,
      cloakedSlug: click.cloaked_slug,
      timestamp: new Date(click.timestamp || Date.now()),
      referrerDomain: click.referrer_domain || 'direct',
      userAgent: click.user_agent || null,
      deviceType: click.device_type || 'unknown',
      browser: click.browser || null,
      country: click.country || 'Global',
      ipHash: click.ip_hash,
      destinationUrl: click.destination_url || '',
      isPreview: false
    });
  },

  async getClicks(programId?: string, limit = 100): Promise<ClickRecord[]> {
    const conditions = programId ? [eq(clicks.programId, programId)] : [];
    const rows = conditions.length > 0
      ? await db.select().from(clicks).where(and(...conditions)).orderBy(desc(clicks.timestamp)).limit(limit)
      : await db.select().from(clicks).orderBy(desc(clicks.timestamp)).limit(limit);

    return rows.map(c => ({
      id: c.id,
      program_id: c.programId,
      program_name: c.programName,
      cloaked_slug: c.cloakedSlug,
      timestamp: c.timestamp.toISOString(),
      ip_hash: c.ipHash,
      user_agent: c.userAgent || 'Unknown',
      referrer_url: c.referrerDomain || 'direct',
      destination_url: c.destinationUrl || undefined,
      referrer_domain: c.referrerDomain || 'direct',
      device_type: (c.deviceType as any) || 'unknown',
      browser: c.browser || 'Unknown',
      country: c.country || 'Global'
    }));
  },

  async clearAllClicks(): Promise<number> {
    const res = await db.delete(clicks).returning({ id: clicks.id });
    return res.length;
  },

  // VISITOR TRACKING
  async recordVisitorSession(sessionId: string, ipHash: string, userAgent?: string): Promise<boolean> {
    const existing = await db.select({ id: visitorSessions.id, lastSeenAt: visitorSessions.lastSeenAt, pageViews: visitorSessions.pageViews })
      .from(visitorSessions)
      .where(or(
        eq(visitorSessions.sessionId, sessionId),
        and(
          eq(visitorSessions.ipHash, ipHash),
          sql`${visitorSessions.lastSeenAt} > NOW() - INTERVAL '30 minutes'`
        )
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(visitorSessions)
        .set({
          lastSeenAt: new Date(),
          pageViews: (existing[0].pageViews || 1) + 1
        })
        .where(eq(visitorSessions.id, existing[0].id));
      return false; // returning visitor session
    }

    const id = `vis_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await db.insert(visitorSessions).values({
      id,
      sessionId,
      ipHash,
      userAgent: userAgent || null,
      pageViews: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date()
    });

    return true; // new unique visitor
  },

  async getVisitorCount(): Promise<{ total: number; today: number }> {
    const totalRes = await db.select({ count: sql<number>`count(*)::int` }).from(visitorSessions);
    const todayRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(visitorSessions)
      .where(sql`${visitorSessions.firstSeenAt} >= CURRENT_DATE`);

    const total = totalRes[0]?.count || 0;
    const today = todayRes[0]?.count || 0;
    return { total: Math.max(total, 0), today };
  },

  // ANALYTICS (REAL DATABASE EVENTS ONLY — NO FAKE METRICS)
  async getAnalytics(): Promise<AnalyticsSummary> {
    const totalClicksRes = await db.select({ count: sql<number>`count(*)::int` }).from(clicks);
    const totalClicks = totalClicksRes[0]?.count || 0;

    const uniqueClicksRes = await db.select({ count: sql<number>`count(DISTINCT ${clicks.ipHash})::int` }).from(clicks);
    const uniqueClicks = uniqueClicksRes[0]?.count || 0;

    const { total: totalVisitors, today: todayVisitors } = await this.getVisitorCount();

    const todayClicksRes = await db.select({ count: sql<number>`count(*)::int` })
      .from(clicks)
      .where(sql`${clicks.timestamp} >= CURRENT_DATE`);
    const todayClicks = todayClicksRes[0]?.count || 0;

    const clickThroughRate = totalVisitors > 0
      ? Math.round((totalClicks / totalVisitors) * 1000) / 10
      : 0;

    // Top programs by real clicks
    const topProgramsRes = await db.select({
      id: affiliatePrograms.id,
      name: affiliatePrograms.name,
      slug: affiliatePrograms.slug,
      commission_value: affiliatePrograms.commissionValue,
      health_status: affiliatePrograms.healthStatus,
      clicks: sql<number>`count(${clicks.id})::int`
    })
    .from(affiliatePrograms)
    .leftJoin(clicks, eq(affiliatePrograms.id, clicks.programId))
    .groupBy(affiliatePrograms.id, affiliatePrograms.name, affiliatePrograms.slug, affiliatePrograms.commissionValue, affiliatePrograms.healthStatus)
    .orderBy(desc(sql`count(${clicks.id})`))
    .limit(10);

    const topPrograms = topProgramsRes.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      clicks: p.clicks,
      commission_value: p.commission_value || 'Not verified',
      health_status: p.health_status as HealthStatus
    }));

    // Clicks and visitors over last 7 days from PostgreSQL
    const clicksOverTime = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

      const dayClicksRes = await db.select({ count: sql<number>`count(*)::int` })
        .from(clicks)
        .where(sql`DATE(${clicks.timestamp}) = ${dateStr}::date`);
      const dayVisitorsRes = await db.select({ count: sql<number>`count(*)::int` })
        .from(visitorSessions)
        .where(sql`DATE(${visitorSessions.firstSeenAt}) = ${dateStr}::date`);

      clicksOverTime.push({
        date: dateStr,
        label: dayLabel,
        clicks: dayClicksRes[0]?.count || 0,
        visitors: dayVisitorsRes[0]?.count || 0
      });
    }

    // Traffic sources from clicks
    const referrerRes = await db.select({
      domain: sql<string>`COALESCE(${clicks.referrerDomain}, 'direct')`,
      count: sql<number>`count(*)::int`
    })
    .from(clicks)
    .groupBy(sql`COALESCE(${clicks.referrerDomain}, 'direct')`)
    .orderBy(desc(sql`count(*)`))
    .limit(6);

    const referrerBreakdown = referrerRes.map(r => ({
      domain: r.domain,
      clicks: r.count,
      percentage: totalClicks > 0 ? Math.round((r.count / totalClicks) * 100) : 0
    }));

    // Devices
    const deviceRes = await db.select({
      device: sql<string>`COALESCE(${clicks.deviceType}, 'desktop')`,
      count: sql<number>`count(*)::int`
    })
    .from(clicks)
    .groupBy(sql`COALESCE(${clicks.deviceType}, 'desktop')`);

    const deviceMap: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
    deviceRes.forEach(r => {
      const dev = r.device === 'mobile' || r.device === 'tablet' ? r.device : 'desktop';
      deviceMap[dev] = (deviceMap[dev] || 0) + r.count;
    });

    const deviceBreakdown = (['desktop', 'mobile', 'tablet'] as DeviceType[]).map(dev => ({
      device: dev,
      clicks: deviceMap[dev],
      percentage: totalClicks > 0 ? Math.round((deviceMap[dev] / totalClicks) * 100) : 0
    }));

    const healthyRes = await db.select({ count: sql<number>`count(*)::int` }).from(affiliatePrograms).where(eq(affiliatePrograms.healthStatus, 'healthy'));
    const brokenRes = await db.select({ count: sql<number>`count(*)::int` }).from(affiliatePrograms).where(eq(affiliatePrograms.healthStatus, 'down'));

    return {
      totalVisitors,
      totalClicks,
      uniqueClicks,
      clickThroughRate,
      todayVisitors,
      todayClicks,
      estimatedRevenue: 0, // Real revenue: 0 until verified conversion reports are integrated
      healthyLinksCount: healthyRes[0]?.count || 0,
      brokenLinksCount: brokenRes[0]?.count || 0,
      topPrograms,
      clicksOverTime,
      referrerBreakdown,
      deviceBreakdown
    };
  },

  // REVIEWS OPERATIONS (Public users ONLY see status = 'approved')
  async getReviews(programId?: string, status?: UserReview['status']): Promise<UserReview[]> {
    let conditions = [];
    if (programId) conditions.push(eq(reviews.programId, programId));
    if (status) conditions.push(eq(reviews.status, status));

    const rows = conditions.length > 0
      ? await db.select().from(reviews).where(and(...conditions)).orderBy(desc(reviews.createdAt))
      : await db.select().from(reviews).orderBy(desc(reviews.createdAt));

    return rows.map(r => ({
      id: r.id,
      program_id: r.programId,
      program_name: 'Affiliate Partner',
      user_name: r.userName,
      rating: r.rating,
      comment: r.comment,
      timestamp: r.createdAt.toISOString(),
      verified: r.verified,
      status: r.status as UserReview['status']
    }));
  },

  async createReview(data: { program_id: string; user_name: string; user_email?: string; rating: number; comment: string }): Promise<UserReview> {
    const id = `rev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const [newRev] = await db.insert(reviews).values({
      id,
      programId: data.program_id,
      userName: data.user_name.trim(),
      userEmail: data.user_email?.trim() || null,
      rating: data.rating,
      comment: data.comment.trim(),
      status: 'pending', // Moderation required
      verified: false
    }).returning();

    return {
      id: newRev.id,
      program_id: newRev.programId,
      user_name: newRev.userName,
      rating: newRev.rating,
      comment: newRev.comment,
      timestamp: newRev.createdAt.toISOString(),
      verified: newRev.verified,
      status: 'pending'
    };
  },

  async updateReviewStatus(id: string, status: UserReview['status'], verified = false): Promise<boolean> {
    const res = await db.update(reviews)
      .set({ status, verified, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id });
    return res.length > 0;
  },

  async deleteReview(id: string): Promise<boolean> {
    const res = await db.delete(reviews).where(eq(reviews.id, id)).returning({ id: reviews.id });
    return res.length > 0;
  },

  // CONTACT MESSAGES OPERATIONS
  async getContactMessages(): Promise<ContactMessage[]> {
    const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
    return rows.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      subject: m.subject,
      message: m.message,
      timestamp: m.createdAt.toISOString(),
      status: m.status as ContactMessage['status']
    }));
  },

  async createContactMessage(data: { name: string; email: string; subject: string; message: string; program_id?: string }): Promise<ContactMessage> {
    const id = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const [newMsg] = await db.insert(contactMessages).values({
      id,
      name: data.name.trim(),
      email: data.email.trim(),
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: 'unread'
    }).returning();

    return {
      id: newMsg.id,
      name: newMsg.name,
      email: newMsg.email,
      subject: newMsg.subject,
      message: newMsg.message,
      timestamp: newMsg.createdAt.toISOString(),
      status: 'unread'
    };
  },

  async markContactMessageRead(id: string): Promise<boolean> {
    const res = await db.update(contactMessages)
      .set({ status: 'read' })
      .where(eq(contactMessages.id, id))
      .returning({ id: contactMessages.id });
    return res.length > 0;
  },

  async deleteContactMessage(id: string): Promise<boolean> {
    const res = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
    return res.length > 0;
  },

  async clearAllContactMessages(): Promise<number> {
    const res = await db.delete(contactMessages).returning({ id: contactMessages.id });
    return res.length;
  },

  // NOTIFICATION SETTINGS & LOGS
  async getNotifications(): Promise<{ settings: NotificationSettings; history: NotificationLog[] }> {
    const settingsRows = await db.select().from(notificationSettings).limit(1);
    const settings = settingsRows[0] || {
      enableEmail: true,
      alertEmail: process.env.OWNER_EMAIL || '',
      rateLimitMode: 'instant',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      fromEmail: '',
      webhookUrl: '',
      enableWebhook: false
    };

    const historyRows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
    const history: NotificationLog[] = historyRows.map(n => ({
      id: n.id,
      program_id: n.type,
      program_name: n.type,
      channel: n.channel as any,
      sent_status: n.status as any,
      timestamp: n.createdAt.toISOString(),
      message: n.message
    }));

    return {
      settings: {
        enable_email: settings.enableEmail,
        alert_email: settings.alertEmail,
        rate_limit_mode: settings.rateLimitMode as any,
        smtp_host: settings.smtpHost || '',
        smtp_port: settings.smtpPort || 587,
        smtp_user: settings.smtpUser || '',
        smtp_pass: decryptSecret(settings.smtpPass || ''),
        from_email: settings.fromEmail || '',
        webhook_url: settings.webhookUrl || '',
        enable_webhook: settings.enableWebhook
      },
      history
    };
  },

  async addNotification(notif: NotificationLog): Promise<void> {
    await db.insert(notifications).values({
      id: notif.id,
      type: notif.program_name || 'System Alert',
      channel: notif.channel,
      target: notif.channel === 'email' ? 'Admin Email' : 'Webhook',
      status: notif.sent_status === 'sent' ? 'delivered' : 'failed',
      message: notif.message
    });
  },

  async updateNotificationSettings(updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const setValues: Record<string, any> = { updatedAt: new Date() };
    if (updates.enable_email !== undefined) setValues.enableEmail = updates.enable_email;
    if (updates.alert_email !== undefined) setValues.alertEmail = updates.alert_email;
    if (updates.rate_limit_mode !== undefined) setValues.rateLimitMode = updates.rate_limit_mode;
    if (updates.smtp_host !== undefined) setValues.smtpHost = updates.smtp_host;
    if (updates.smtp_port !== undefined) setValues.smtpPort = updates.smtp_port;
    if (updates.smtp_user !== undefined) setValues.smtpUser = updates.smtp_user;
    if (updates.smtp_pass !== undefined && updates.smtp_pass !== '') setValues.smtpPass = encryptSecret(updates.smtp_pass);
    if (updates.from_email !== undefined) setValues.fromEmail = updates.from_email;
    if (updates.webhook_url !== undefined) setValues.webhookUrl = updates.webhook_url;
    if (updates.enable_webhook !== undefined) setValues.enableWebhook = updates.enable_webhook;

    await db.update(notificationSettings).set(setValues).where(eq(notificationSettings.id, 'default'));
    const { settings } = await this.getNotifications();
    return settings;
  },

  // AUDIT LOGS
  async logAuditEvent(userId: string, userEmail: string, action: string, resourceType: string, resourceId?: string, metadata?: Record<string, any>, ipHash = '127.0.0.1'): Promise<void> {
    const id = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    try {
      await db.insert(auditLogs).values({
        id,
        userId,
        userEmail,
        action,
        resourceType,
        resourceId: resourceId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipHash
      });
    } catch (err) {
      console.error('[Audit] Failed to record audit log:', err);
    }
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
    return rows.map(r => ({
      id: r.id,
      user_id: r.userId || 'system',
      user_email: r.userEmail || 'system',
      action: r.action,
      resource_type: r.resourceType,
      resource_id: r.resourceId || undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.createdAt.toISOString(),
      ip_hash: r.ipHash || '127.0.0.1'
    }));
  }
};

export const db_instance = postgresDb;
export { postgresDb as db };
