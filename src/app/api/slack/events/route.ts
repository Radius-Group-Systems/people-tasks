import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySlackRequest } from "@/lib/slack-verify";
import { parseSlackMessage } from "@/lib/slack-task-parser";
import { getSlackClient } from "@/lib/slack";
import { tenantDb, query } from "@/lib/db";

export const runtime = "nodejs";

const ORG_ID = process.env.SLACK_ASK_ORG_ID;
const CHANNEL_ID = process.env.SLACK_ASK_CHANNEL_ID;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackRequest(signature, timestamp, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Slack URL verification challenge
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;

  // Only process real user messages (not bot messages, edits, etc.)
  if (event.type !== "message" || event.subtype || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  // Filter to configured channel
  if (CHANNEL_ID && event.channel !== CHANNEL_ID) {
    return NextResponse.json({ ok: true });
  }

  // Return 200 immediately, process async (Slack 3s timeout)
  after(async () => {
    await processSlackAsk(payload.event_id, event);
  });

  return NextResponse.json({ ok: true });
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  bot_id?: string;
  user: string;
  text: string;
  channel: string;
  ts: string;
}

async function processSlackAsk(eventId: string, event: SlackMessageEvent) {
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

      // 3. Parse message with Bedrock
      const parsed = await parseSlackMessage(event.text, person.name);

      // 4. Create action item (owner_type="me" — it's a task FOR Jeff)
      const actionResult = await db.query<{ id: number; title: string }>(
        `INSERT INTO action_items
          (title, description, owner_type, source_person_id, priority, due_at, org_id)
         VALUES ($1, $2, 'me', $3, $4, $5, $6)
         RETURNING id, title`,
        [
          parsed.title.slice(0, 500),
          parsed.description,
          person.id,
          parsed.priority,
          parsed.due_hint || null,
          ORG_ID,
        ]
      );
      const task = actionResult.rows[0];

      // 5. Mark event as processed
      await db.query(
        "INSERT INTO slack_processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [eventId]
      );

      // 6. Reply in thread
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
