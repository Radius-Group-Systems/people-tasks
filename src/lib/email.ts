import nodemailer from "nodemailer";
import { getOne, query } from "./db";

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  imap_label: string; // Gmail label to poll, e.g. "PeopleTasks"
}

export async function getEmailSettings(): Promise<EmailSettings | null> {
  const row = await getOne<{ value: EmailSettings }>(
    "SELECT value FROM settings WHERE key = 'email'",
  );
  return row?.value ?? null;
}

export async function saveEmailSettings(settings: EmailSettings): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('email', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [JSON.stringify(settings)]
  );
}

function createTransport(settings: EmailSettings) {
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_port === 465,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string }> {
  const settings = await getEmailSettings();
  if (!settings) {
    throw new Error("Email not configured. Go to Settings to set up Gmail.");
  }

  const transport = createTransport(settings);

  const result = await transport.sendMail({
    from: `"${settings.from_name}" <${settings.from_email}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  return { messageId: result.messageId };
}

/**
 * Format an action item into a nice email to send to someone.
 */
export function formatTaskEmail(
  title: string,
  description: string | null,
  checklist: { text: string; done: boolean }[],
  fromName: string,
): { subject: string; text: string; html: string } {
  const subject = title;

  // Plain text version
  const textParts = [`Hi,\n\n${fromName} has a task for you:\n\n${title}`];
  if (description) textParts.push(`\n${description}`);
  if (checklist.length > 0) {
    textParts.push("\nSubtasks:");
    for (const item of checklist) {
      textParts.push(`  ${item.done ? "[x]" : "[ ]"} ${item.text}`);
    }
  }
  textParts.push(`\n\nSent from PeopleTasks`);
  const text = textParts.join("\n");

  // HTML version
  const htmlParts = [
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">`,
    `<p>Hi,</p>`,
    `<p>${fromName} has a task for you:</p>`,
    `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">`,
    `<h3 style="margin: 0 0 8px 0;">${escapeHtml(title)}</h3>`,
  ];
  if (description) {
    htmlParts.push(`<p style="color: #6b7280; margin: 0 0 12px 0;">${escapeHtml(description)}</p>`);
  }
  if (checklist.length > 0) {
    htmlParts.push(`<div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px;">`);
    htmlParts.push(`<p style="font-size: 12px; text-transform: uppercase; color: #9ca3af; margin: 0 0 8px 0;">Subtasks</p>`);
    for (const item of checklist) {
      const icon = item.done ? "✅" : "⬜";
      htmlParts.push(`<div style="padding: 2px 0;">${icon} ${escapeHtml(item.text)}</div>`);
    }
    htmlParts.push(`</div>`);
  }
  htmlParts.push(`</div>`);
  htmlParts.push(`<p style="color: #9ca3af; font-size: 12px;">Sent from PeopleTasks</p>`);
  htmlParts.push(`</div>`);

  return { subject, text, html: htmlParts.join("\n") };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
