import { WebClient, KnownBlock } from "@slack/web-api";
import { getOne } from "./db";

async function getSetting(key: string, orgId: string): Promise<string | null> {
  const row = await getOne<{ value: string }>("SELECT value FROM settings WHERE key = $1 AND org_id = $2", [key, orgId]);
  return row?.value ?? null;
}

export async function getSlackClient(orgId: string): Promise<WebClient | null> {
  const token = process.env.SLACK_BOT_TOKEN || await getSetting("slack_bot_token", orgId);
  if (!token) return null;
  return new WebClient(token);
}

interface SlackTaskMessage {
  title: string;
  description?: string | null;
  priority: string;
  dueDate?: string | null;
  checklist?: { text: string; done: boolean }[];
  fromPerson?: string;
}

export function formatTaskMessage(task: SlackTaskMessage): { text: string; blocks: object[] } {
  const priorityEmoji: Record<string, string> = {
    urgent: ":rotating_light:",
    high: ":orange_circle:",
    normal: ":white_circle:",
    low: ":large_blue_circle:",
  };

  const emoji = priorityEmoji[task.priority] || ":white_circle:";
  const text = `${emoji} *${task.title}*`;

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *${task.title}*${task.priority !== "normal" ? ` (${task.priority})` : ""}`,
      },
    },
  ];

  if (task.description) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: task.description },
    });
  }

  const contextItems: object[] = [];
  if (task.fromPerson) {
    contextItems.push({ type: "mrkdwn", text: `*From:* ${task.fromPerson}` });
  }
  if (task.dueDate) {
    contextItems.push({ type: "mrkdwn", text: `*Due:* ${new Date(task.dueDate).toLocaleDateString()}` });
  }
  if (contextItems.length > 0) {
    blocks.push({ type: "context", elements: contextItems });
  }

  if (task.checklist && task.checklist.length > 0) {
    const checklistText = task.checklist
      .map((c) => `${c.done ? ":white_check_mark:" : ":white_large_square:"} ${c.text}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: checklistText },
    });
  }

  return { text, blocks };
}

export async function sendSlackMessage(channel: string, task: SlackTaskMessage, orgId: string): Promise<string | null> {
  const client = await getSlackClient(orgId);
  if (!client) throw new Error("Slack not configured. Set SLACK_BOT_TOKEN in .env.local or settings.");

  const { text, blocks } = formatTaskMessage(task);

  const result = await client.chat.postMessage({
    channel,
    text,
    blocks: blocks as KnownBlock[],
  });

  return result.ts || null;
}

export async function lookupSlackUser(slackHandle: string, orgId: string): Promise<string | null> {
  const client = await getSlackClient(orgId);
  if (!client) return null;

  const handle = slackHandle.replace(/^@/, "");
  try {
    const result = await client.users.lookupByEmail({ email: handle });
    return result.user?.id || null;
  } catch {
    // Try by display name as fallback - not directly supported, return handle
    return handle;
  }
}
