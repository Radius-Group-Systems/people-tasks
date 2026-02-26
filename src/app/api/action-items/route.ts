import { NextRequest, NextResponse } from "next/server";
import { getMany, query } from "@/lib/db";
import { ActionItem } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const involvesPersonId = searchParams.get("involves_person_id");
  const ownerType = searchParams.get("owner_type");
  const encounterId = searchParams.get("encounter_id");
  const status = searchParams.get("status") || "open";

  // Auto-resurface: move snoozed items past their snoozed_until date back to open
  await query(
    `UPDATE action_items SET status = 'open', snoozed_until = NULL, updated_at = NOW()
     WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= NOW()`
  );

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (status !== "all") {
    conditions.push(`ai.status = $${paramIdx++}`);
    params.push(status);
  }
  if (personId) {
    conditions.push(`ai.person_id = $${paramIdx++}`);
    params.push(personId);
  }
  if (involvesPersonId) {
    conditions.push(`(ai.person_id = $${paramIdx} OR ai.source_person_id = $${paramIdx})`);
    params.push(involvesPersonId);
    paramIdx++;
  }
  if (ownerType) {
    conditions.push(`ai.owner_type = $${paramIdx++}`);
    params.push(ownerType);
  }
  if (encounterId) {
    conditions.push(`ai.encounter_id = $${paramIdx++}`);
    params.push(encounterId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const items = await getMany<ActionItem>(`
    SELECT ai.*,
      p.name AS person_name,
      sp.name AS source_person_name,
      e.title AS encounter_title,
      CASE WHEN ai.due_trigger = 'next_meeting' AND p.next_meeting_at IS NOT NULL
        THEN p.next_meeting_at
        ELSE NULL
      END AS next_meeting_date
    FROM action_items ai
    LEFT JOIN people p ON p.id = ai.person_id
    LEFT JOIN people sp ON sp.id = ai.source_person_id
    LEFT JOIN encounters e ON e.id = ai.encounter_id
    ${where}
    ORDER BY
      CASE ai.priority
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'low' THEN 3
      END,
      COALESCE(
        ai.due_at,
        CASE WHEN ai.due_trigger = 'next_meeting' THEN p.next_meeting_at END
      ) ASC NULLS LAST,
      ai.created_at DESC
  `, params);

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title, description, owner_type, person_id, source_person_id,
    encounter_id, priority, due_at, due_trigger, checklist, links, attachments
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await query<ActionItem>(
    `INSERT INTO action_items (title, description, owner_type, person_id, source_person_id, encounter_id, priority, due_at, due_trigger, checklist, links, attachments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      title.trim(),
      description || null,
      owner_type || "me",
      person_id || null,
      source_person_id || null,
      encounter_id || null,
      priority || "normal",
      due_at || null,
      due_trigger || null,
      JSON.stringify(checklist || []),
      JSON.stringify(links || []),
      JSON.stringify(attachments || []),
    ]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}
