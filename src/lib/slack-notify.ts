import { getSlackClient } from "./slack";
import { getOne } from "./db";

/**
 * Post a status update back to the original Slack thread when a task changes.
 * @mentions the person who requested the task.
 */
export async function notifySlackThread(opts: {
  orgId: string;
  slackChannelId: string;
  slackThreadTs: string;
  sourcePersonId: number | null;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
}) {
  const { orgId, slackChannelId, slackThreadTs, sourcePersonId, taskTitle, oldStatus, newStatus } = opts;

  const client = await getSlackClient(orgId);
  if (!client) return;

  // Resolve the requester's Slack ID for @mention
  let mention = "";
  if (sourcePersonId) {
    const person = await getOne<{ slack_id: string | null; name: string }>(
      "SELECT slack_id, name FROM people WHERE id = $1",
      [sourcePersonId]
    );
    if (person?.slack_id) {
      mention = `<@${person.slack_id}> `;
    }
  }

  const statusMessages: Record<string, string> = {
    in_progress: `:hammer_and_wrench: ${mention}Working on it: *${taskTitle}*`,
    done: `:white_check_mark: ${mention}Done! *${taskTitle}* is complete.`,
    snoozed: `:zzz: *${taskTitle}* has been snoozed — I'll get to it later.`,
    open: `:arrows_counterclockwise: *${taskTitle}* has been reopened.`,
  };

  const text = statusMessages[newStatus];
  if (!text) return;

  try {
    await client.chat.postMessage({
      channel: slackChannelId,
      thread_ts: slackThreadTs,
      text,
    });
  } catch (err) {
    console.error("[slack-notify] Failed to post thread update:", err);
  }
}
