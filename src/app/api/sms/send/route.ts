import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ActionItem } from "@/lib/types";
import { sendSms, formatTaskSms } from "@/lib/sms";

export const POST = withAuth(async (req, { db }) => {
  const body = await req.json();
  const { action_item_id } = body;

  if (!action_item_id) {
    return NextResponse.json({ error: "action_item_id required" }, { status: 400 });
  }

  const item = await db.getOne<ActionItem & { person_phone: string | null; source_person_name: string | null }>(
    `SELECT ai.*,
       p.phone AS person_phone,
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

  if (!item.person_phone) {
    return NextResponse.json(
      { error: "No phone number. Set person's phone on their profile." },
      { status: 400 }
    );
  }

  const dueInfo = item.due_at
    ? new Date(item.due_at).toLocaleDateString()
    : null;

  try {
    const message = formatTaskSms(item.title, item.source_person_name, dueInfo);
    await sendSms(item.person_phone, message);

    // Track that it was sent
    await db.query(
      "UPDATE action_items SET sent_via = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2",
      ["sms", action_item_id]
    );

    return NextResponse.json({ sent_to: item.person_phone, via: "sms" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
});
