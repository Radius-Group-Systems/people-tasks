import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";
import { getEmailSettings } from "./email";
import { getMany, getOne, query } from "./db";
import { Person, EmailAddress, EmailAttachment } from "./types";
import fs from "fs/promises";
import path from "path";

interface ImportedEmail {
  messageId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  date: Date;
  text: string;
  html: string | null;
  attachments: EmailAttachment[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  debug?: {
    mailbox: string;
    totalInMailbox: number;
    fetched: number;
  };
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "emails");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Connect to Gmail via IMAP, fetch emails from the configured label,
 * and import them as encounters with attachments.
 */
export async function importEmails(maxMessages = 20): Promise<ImportResult> {
  const settings = await getEmailSettings();
  if (!settings) {
    throw new Error("Email not configured. Go to Settings to set up Gmail.");
  }

  const client = new ImapFlow({
    host: settings.imap_host,
    port: settings.imap_port,
    secure: true,
    auth: {
      user: settings.imap_user,
      pass: settings.imap_pass,
    },
    logger: false,
  });

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  try {
    await client.connect();

    // Open the configured mailbox/label
    const mailbox = settings.imap_label || "INBOX";
    const lock = await client.getMailboxLock(mailbox);

    try {
      const messages: ImportedEmail[] = [];
      const totalInMailbox = client.mailbox ? client.mailbox.exists : 0;

      if (totalInMailbox > 0) {
        await ensureUploadDir();

        const startSeq = Math.max(1, totalInMailbox - maxMessages + 1);
        const range = `${startSeq}:*`;

        for await (const msg of client.fetch(
          range,
          {
            envelope: true,
            source: true,
            uid: true,
          }
        )) {
          if (messages.length >= maxMessages) break;

          const envelope = msg.envelope;
          if (!envelope) continue;

          // Use mailparser for robust parsing (handles MIME, attachments, encoding)
          let parsed: ParsedMail | null = null;
          const attachments: EmailAttachment[] = [];

          if (msg.source) {
            try {
              parsed = await simpleParser(msg.source);

              // Save attachments to disk
              if (parsed.attachments && parsed.attachments.length > 0) {
                for (const att of parsed.attachments) {
                  // Skip inline images (embedded in HTML)
                  if (att.contentDisposition === "inline" && !att.filename) continue;

                  const safeName = sanitizeFilename(att.filename || `attachment-${Date.now()}`);
                  const uniqueName = `${Date.now()}-${msg.uid}-${safeName}`;
                  const filePath = path.join(UPLOAD_DIR, uniqueName);

                  await fs.writeFile(filePath, att.content);

                  attachments.push({
                    name: att.filename || safeName,
                    content_type: att.contentType || "application/octet-stream",
                    size: att.size || att.content.length,
                    path: `/uploads/emails/${uniqueName}`,
                  });
                }
              }
            } catch {
              // If mailparser fails, fall back to envelope data only
            }
          }

          // Parse from/to/cc from envelope (more reliable for addressing)
          const from = envelope.from?.[0]
            ? { name: envelope.from[0].name || "", address: envelope.from[0].address || "" }
            : { name: "Unknown", address: "" };

          const to = (envelope.to || []).map((a) => ({
            name: a.name || "",
            address: a.address || "",
          }));

          const cc = (envelope.cc || []).map((a) => ({
            name: a.name || "",
            address: a.address || "",
          }));

          // Get text content: prefer mailparser result, fall back to envelope
          const textContent = parsed?.text || "";

          messages.push({
            messageId: envelope.messageId || `${msg.uid}-${Date.now()}`,
            from,
            to,
            cc,
            subject: envelope.subject || "(no subject)",
            date: envelope.date || new Date(),
            text: textContent,
            html: parsed?.html || null,
            attachments,
          });
        }
      }

      // Load people to match email addresses
      const people = await getMany<Person>(
        "SELECT * FROM people WHERE email IS NOT NULL"
      );
      const emailToPersonId = new Map<string, number>();
      for (const p of people) {
        if (p.email) emailToPersonId.set(p.email.toLowerCase(), p.id);
      }

      // Import each email as an encounter
      for (const email of messages) {
        try {
          // Check if already imported
          const existing = await getOne(
            "SELECT id FROM encounters WHERE email_message_id = $1",
            [email.messageId]
          );
          if (existing) {
            result.skipped++;
            continue;
          }

          // Create the encounter with full email metadata
          const encResult = await query<{ id: number }>(
            `INSERT INTO encounters (
              title, encounter_type, occurred_at, summary, raw_transcript,
              source, email_message_id,
              email_from, email_to, email_cc, email_attachments
            )
            VALUES ($1, 'email', $2, $3, $4, 'email', $5, $6, $7, $8, $9)
            RETURNING id`,
            [
              email.subject,
              email.date.toISOString(),
              `Email from ${email.from.name || email.from.address} to ${email.to.map(t => t.name || t.address).join(", ")}`,
              email.text || null,
              email.messageId,
              JSON.stringify(email.from),
              JSON.stringify(email.to),
              JSON.stringify(email.cc),
              JSON.stringify(email.attachments),
            ]
          );
          const encounterId = encResult.rows[0].id;

          // Link participants by email address
          const allAddresses = [email.from, ...email.to, ...email.cc];
          for (const addr of allAddresses) {
            const personId = emailToPersonId.get(addr.address.toLowerCase());
            if (personId) {
              await query(
                `INSERT INTO encounter_participants (encounter_id, person_id)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [encounterId, personId]
              );
            }
          }

          result.imported++;
        } catch (err) {
          result.errors.push(`Failed to import "${email.subject}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      result.debug = { mailbox, totalInMailbox, fetched: messages.length };
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) throw err;
    throw new Error(`IMAP connection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}
