import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types.ts';
import { db } from '../db/index.ts';
import { sessions } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { SESSION_SECRET } from './secrets.ts';

const isProduction = process.env.NODE_ENV === 'production';

const JWT_SECRET = SESSION_SECRET;

const TOKEN_EXPIRY = '7d';

export interface AuthUserPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId?: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      sessionToken?: string;
    }
  }
}

/**
 * Hash a plain text password with bcrypt (salt rounds = 10)
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

/**
 * Verify a plain text password against a bcrypt hash
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Hash token for database indexing
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a signed JWT session token and persist server-side session in PostgreSQL
 */
export async function createSession(
  user: { id: string; email: string; name: string; role: UserRole },
  ipHash = '127.0.0.1'
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId
    },
    JWT_SECRET!,
    { expiresIn: TOKEN_EXPIRY }
  );

  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await db.insert(sessions).values({
      id: tokenHash,
      userId: user.id,
      userEmail: user.email,
      role: user.role,
      expiresAt,
      revoked: false,
      ipHash,
    });
  } catch (err) {
    console.error('[Auth] Failed to persist session in PostgreSQL:', err);
    throw new Error('Could not create session');
  }

  return token;
}

/**
 * Revoke a session in PostgreSQL
 */
export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  try {
    await db.update(sessions).set({ revoked: true }).where(eq(sessions.id, tokenHash));
  } catch (err) {
    console.error('[Auth] Failed to revoke session in PostgreSQL:', err);
  }
}

/**
 * Verify and decode a JWT session token, checking revocation in PostgreSQL
 */
export async function verifyAuthToken(token: string): Promise<AuthUserPayload | null> {
  // 1. Cryptographic signature + expiry check FIRST (rejects forged tokens outright).
  let payload: AuthUserPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AuthUserPayload;
  } catch {
    return null;
  }
  if (!payload || !payload.userId) return null;

  // 2. A matching, non-revoked server-side session row is REQUIRED (fail closed on DB errors).
  try {
    const rows = await db.select().from(sessions).where(eq(sessions.id, hashToken(token))).limit(1);
    if (rows.length === 0) return null;
    const sess = rows[0];
    if (sess.revoked || sess.expiresAt <= new Date()) return null;
    return {
      userId: sess.userId,
      email: sess.userEmail,
      name: payload.name || sess.userEmail,
      role: sess.role as UserRole,
      sessionId: payload.sessionId
    };
  } catch (err) {
    console.error('[Auth] Session lookup failed:', err);
    return null;
  }
}

/** Revoke every active session of a user (e.g. after password change or deletion). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.update(sessions).set({ revoked: true }).where(eq(sessions.userId, userId));
}

/**
 * Set HttpOnly, Secure, SameSite session cookie
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/'
  });
}

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
  if (req.cookies && typeof req.cookies.auth_token === 'string') return req.cookies.auth_token;
  return undefined;
}

/**
 * Express middleware: requires an authenticated user with a valid Bearer token or HttpOnly cookie.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please sign in with valid credentials.' }
    });
    return;
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Session expired or invalidated. Please log in again.' }
    });
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
}

/**
 * Express middleware: enforces specific role(s) (e.g. 'super_admin' or 'editor').
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of [${allowedRoles.join(', ')}] privileges.`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication: attaches req.user if a valid token is present, does not fail if absent.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (token) {
    const user = await verifyAuthToken(token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  }

  next();
}
