import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySlackRequest } from "@/lib/slack-verify";
import { parseSlackMessage } from "@/lib/slack-task-parser";
import { getSlackClient } from "@/lib/slack";
import { tenantDb, query } from "@/lib/db";
import { uploadFile } from "@/lib/storage";

export const runtime = "nodejs";

const ORG_ID = process.env.SLACK_ASK_ORG_ID;
const CHANNEL_ID = process.env.SLACK_ASK_CHANNEL_ID;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const payload = JSON.parse(rawBody);

  // Slack URL verification challenge (handle before signature check for initial setup)
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Verify signing secret on all real events
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackRequest(signature, timestamp, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  console.log(`[slack-ask] Event received: type=${event.type}, subtype=${event.subtype || "none"}, channel=${event.channel}`);

  // Filter to configured channel
  if (CHANNEL_ID && event.channel !== CHANNEL_ID) {
    return NextResponse.json({ ok: true });
  }

  // Handle message deletions — remove the associated task
  if (event.type === "message" && event.subtype === "message_deleted") {
    after(async () => {
      await processSlackDelete(event);
    });
    return NextResponse.json({ ok: true });
  }

  // Handle message_changed that might be a deletion (Slack sometimes sends this instead)
  if (event.type === "message" && event.subtype === "message_changed") {
    console.log(`[slack-ask] message_changed details: ${JSON.stringify({ hidden: event.hidden, deleted_ts: event.deleted_ts, previous_ts: event.previous_message?.ts, message_ts: event.message?.ts, message_subtype: event.message?.subtype })}`);
    // If the message was tombstoned (hidden=true with deleted_ts), treat as deletion
    if (event.hidden && event.deleted_ts) {
      after(async () => {
        await processSlackDelete(event);
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Only process real user messages (not bot messages, edits, etc.)
  // Allow file_share subtype (messages with attachments)
  const allowedSubtypes = [undefined, "file_share"];
  if (event.type !== "message" || !allowedSubtypes.includes(event.subtype) || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  // Return 200 immediately, process async (Slack 3s timeout)
  after(async () => {
    await processSlackAsk(payload.event_id, event);
  });

  return NextResponse.json({ ok: true });
}

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  url_private_download?: string;
  url_private?: string;
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  bot_id?: string;
  user: string;
  text: string;
  channel: string;
  ts: string;
  files?: SlackFile[];
}

async function processSlackDelete(event: { channel: string; deleted_ts?: string; previous_message?: { ts: string } }) {
  try {
    const messageTs = event.deleted_ts || event.previous_message?.ts;
    if (!ORG_ID || !messageTs) {
      console.log(`[slack-ask] Delete skipped: orgId=${!!ORG_ID}, messageTs=${messageTs}`);
      return;
    }

    console.log(`[slack-ask] Deleting task for message ${messageTs} in ${event.channel}`);
    const db = await tenantDb(ORG_ID);
    try {
      const result = await db.query(
        "DELETE FROM action_items WHERE slack_channel_id = $1 AND slack_thread_ts = $2",
        [event.channel, messageTs]
      );
      console.log(`[slack-ask] Deleted ${result.rowCount} task(s) for removed message ${messageTs}`);
    } finally {
      await db.release();
    }
  } catch (err) {
    console.error("[slack-ask] Error processing message deletion:", err);
  }
}

async function processSlackAsk(eventId: string, event: SlackMessageEvent) {
  console.log(`[slack-ask] Processing event ${eventId} from user ${event.user}, files: ${event.files?.length || 0}`);
  try {
    if (!ORG_ID) {
      console.error("[slack-ask] SLACK_ASK_ORG_ID not configured");
      return;
    }

    const db = await tenantDb(ORG_ID);

    try {
      // Idempotency: skip duplicate events (Slack retries)
      const existing = await db.getOne(
        "SELECT event_id FROM slack_processed_events WHERE event_id = $1",
        [eventId]
      );
      if (existing) return;

      // 1. Resolve the Slack user
      const slackClient = await getSlackClient(ORG_ID);
      if (!slackClient) {
        console.error("[slack-ask] Slack client not configured");
        return;
      }

      const userInfo = await slackClient.users.info({ user: event.user });
      const slackUser = userInfo.user;
      const senderName = slackUser?.real_name || slackUser?.name || "Unknown";
      const senderEmail = slackUser?.profile?.email || null;
      const slackHandle = slackUser?.name || null;

      // 2. Look up or create person (cascade: slack_id → email → slack_handle → create)
      let person = await db.getOne<{ id: number; name: string }>(
        "SELECT id, name FROM people WHERE slack_id = $1",
        [event.user]
      );

      if (!person && senderEmail) {
        person = await db.getOne<{ id: number; name: string }>(
          "SELECT id, name FROM people WHERE LOWER(email) = LOWER($1)",
          [senderEmail]
        );
        if (person) {
          await db.query("UPDATE people SET slack_id = $1 WHERE id = $2", [event.user, person.id]);
        }
      }

      if (!person && slackHandle) {
        person = await db.getOne<{ id: number; name: string }>(
          "SELECT id, name FROM people WHERE slack_handle = $1",
          [slackHandle]
        );
        if (person) {
          await db.query("UPDATE people SET slack_id = $1 WHERE id = $2", [event.user, person.id]);
        }
      }

      if (!person) {
        const result = await db.query<{ id: number; name: string }>(
          `INSERT INTO people (name, email, slack_handle, slack_id, org_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, name`,
          [senderName, senderEmail, slackHandle, event.user, ORG_ID]
        );
        person = result.rows[0];
      }

      // 3. Parse message with Bedrock (also extracts links from Slack mrkdwn)
      const parsed = await parseSlackMessage(event.text || "", person.name);

      // 4. Download Slack files (images, docs) → upload to S3
      const attachments: { name: string; url: string; type: string; size: number }[] = [];

      if (event.files && event.files.length > 0) {
        const botToken = process.env.SLACK_BOT_TOKEN;
        console.log(`[slack-ask] Processing ${event.files.length} file(s), botToken present: ${!!botToken}`);

        for (const file of event.files) {
          const downloadUrl = file.url_private_download || file.url_private;
          if (!downloadUrl || !botToken) {
            console.log(`[slack-ask] Skipping file ${file.name}: downloadUrl=${!!downloadUrl}, botToken=${!!botToken}`);
            continue;
          }

          try {
            // Download from Slack (requires bot token auth)
            const resp = await fetch(downloadUrl, {
              headers: { Authorization: `Bearer ${botToken}` },
            });
            if (!resp.ok) {
              console.error(`[slack-ask] File download failed for ${file.name}: ${resp.status} ${resp.statusText}`);
              continue;
            }

            const buffer = Buffer.from(await resp.arrayBuffer());
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const s3Key = await uploadFile(
              ORG_ID,
              "slack-attachments",
              `${timestamp}-${safeName}`,
              buffer,
              file.mimetype
            );

            attachments.push({
              name: file.name,
              url: s3Key, // stored as S3 key, resolved via /api/files/[...key]
              type: file.mimetype,
              size: file.size,
            });
          } catch (err) {
            console.error(`[slack-ask] Failed to download file ${file.name}:`, err);
          }
        }
      }

      // 5. Build links array from parsed message links
      const links = parsed.links.map((l) => ({
        url: l.url,
        label: l.label || undefined,
      }));

      // 6. Create action item with links and attachments
      const actionResult = await db.query<{ id: number; title: string }>(
        `INSERT INTO action_items
          (title, description, owner_type, person_id, source_person_id, priority, due_at,
           links, attachments, slack_channel_id, slack_thread_ts, org_id)
         VALUES ($1, $2, 'me', $3, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title`,
        [
          parsed.title.slice(0, 500),
          parsed.description,
          person.id,
          parsed.priority,
          parsed.due_hint || null,
          JSON.stringify(links),
          JSON.stringify(attachments),
          event.channel,
          event.ts,
          ORG_ID,
        ]
      );
      const task = actionResult.rows[0];

      // 7. Mark event as processed
      await db.query(
        "INSERT INTO slack_processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [eventId]
      );

      // 8. Reply in thread
      const priorityEmoji: Record<string, string> = {
        urgent: ":rotating_light:",
        high: ":orange_circle:",
        normal: ":white_check_mark:",
        low: ":large_blue_circle:",
      };
      const emoji = priorityEmoji[parsed.priority] || ":white_check_mark:";

      let replyText = `${emoji} Got it! Task created: *${task.title}*`;
      if (parsed.priority !== "normal") {
        replyText += ` (${parsed.priority} priority)`;
      }
      if (parsed.due_hint) {
        replyText += `\n:calendar: Due: ${new Date(parsed.due_hint).toLocaleDateString()}`;
      }
      if (links.length > 0) {
        replyText += `\n:link: ${links.length} link${links.length > 1 ? "s" : ""} attached`;
      }
      if (attachments.length > 0) {
        replyText += `\n:paperclip: ${attachments.length} file${attachments.length > 1 ? "s" : ""} attached`;
      }

      await slackClient.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: replyText,
      });

    } finally {
      await db.release();
    }

    // Cleanup old processed events (fire-and-forget)
    await query(
      "DELETE FROM slack_processed_events WHERE processed_at < NOW() - INTERVAL '7 days'"
    );
  } catch (err) {
    console.error("[slack-ask] Error processing message:", err);
  }
}
