import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ActionItem } from "@/lib/types";
import { sendSlackMessage } from "@/lib/slack";

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const { action_item_id, channel } = body;

  if (!action_item_id) {
    return NextResponse.json({ error: "action_item_id required" }, { status: 400 });
  }

  const item = await db.getOne<ActionItem & { person_slack_handle: string | null; source_person_name: string | null }>(
    `SELECT ai.*,
       p.slack_handle AS person_slack_handle,
       sp.name AS source_person_name
     FROM action_items ai
     LEFT JOIN people p ON p.id = ai.person_id
     LEFT JOIN people sp ON sp.id = ai.source_person_id
     WHERE ai.id = $1`,
    [action_item_id]
  );

  if (!item) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Determine channel: explicit > person's slack handle > error
  const targetChannel = channel || item.person_slack_handle;
  if (!targetChannel) {
    return NextResponse.json(
      { error: "No Slack channel. Set person's Slack handle or provide a channel." },
      { status: 400 }
    );
  }

  try {
    await sendSlackMessage(targetChannel, {
      title: item.title,
      description: item.description,
      priority: item.priority,
      dueDate: item.due_at,
      checklist: typeof item.checklist === "string" ? JSON.parse(item.checklist) : item.checklist,
      fromPerson: item.source_person_name || undefined,
    }, orgId);

    // Track that it was sent
    await db.query(
      "UPDATE action_items SET sent_via = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2",
      ["slack", action_item_id]
    );

    return NextResponse.json({ sent_to: targetChannel, via: "slack" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
});
