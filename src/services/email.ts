import nodemailer from 'nodemailer';
import type { NotificationSettings } from '../types.ts';

export interface EmailSendOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: 'smtp' | 'simulated';
  error?: string;
}

/**
 * Creates a nodemailer transport from settings or environment variables.
 */
function createTransportFromSettings(settings?: Partial<NotificationSettings>) {
  const host = settings?.smtp_host || process.env.SMTP_HOST;
  const port = Number(settings?.smtp_port || process.env.SMTP_PORT) || 587;
  const user = settings?.smtp_user || process.env.SMTP_USER;
  const pass = settings?.smtp_pass || process.env.SMTP_PASS;
  const secure = settings?.smtp_secure !== undefined ? settings.smtp_secure : port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }

  return null;
}

/**
 * Send an email notification.
 * If SMTP is configured, sends via real SMTP.
 * If not, logs the exact email payload with guidance on configuring SMTP.
 */
export async function sendEmailAlert(
  options: EmailSendOptions,
  settings?: Partial<NotificationSettings>
): Promise<EmailSendResult> {
  const transporter = createTransportFromSettings(settings);
  const from = settings?.from_email || process.env.FROM_EMAIL || 'alerts@affiliateos.io';

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"AffiliateOS Alerts" <${from}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });

      console.log(`[Email] Real email sent via SMTP to ${options.to}: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp'
      };
    } catch (err: any) {
      console.error(`[Email Error] Failed sending to ${options.to} via SMTP:`, err.message);
      return {
        success: false,
        error: `SMTP delivery failed: ${err.message}`,
        provider: 'smtp'
      };
    }
  }

  // Fallback: SMTP is not configured in settings/env
  console.log(`[Email Notice] SMTP not configured. Logged alert intended for ${options.to}: "${options.subject}"`);
  return {
    success: true,
    provider: 'simulated',
    messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    error: 'Notice: SMTP credentials (host, user, pass) are not yet configured in Notification Settings. Configure SMTP to deliver actual emails to inbox.'
  };
}

/**
 * Verify SMTP connection credentials
 */
export async function testSmtpConnection(settings: Partial<NotificationSettings>): Promise<{ ok: boolean; message: string }> {
  const transporter = createTransportFromSettings(settings);
  if (!transporter) {
    return {
      ok: false,
      message: 'SMTP credentials missing. Please provide SMTP Host, Port, Username, and Password.'
    };
  }

  try {
    await transporter.verify();
    return { ok: true, message: 'SMTP connection verified successfully! Ready to deliver live emails.' };
  } catch (err: any) {
    return { ok: false, message: `SMTP verification failed: ${err.message}` };
  }
}
