import { NextRequest, NextResponse } from "next/server";
import { getOne, query } from "@/lib/db";
import { ActionItem } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Fetch current item so we can merge
  const current = await getOne<ActionItem>(
    "SELECT * FROM action_items WHERE id = $1",
    [id]
  );
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = body.title ?? current.title;
  const description = body.description !== undefined ? body.description : current.description;
  const owner_type = body.owner_type ?? current.owner_type;
  const person_id = body.person_id !== undefined ? body.person_id : current.person_id;
  const source_person_id = body.source_person_id !== undefined ? body.source_person_id : current.source_person_id;
  const status = body.status ?? current.status;
  const priority = body.priority ?? current.priority;
  const due_at = body.due_at !== undefined ? body.due_at : current.due_at;
  const due_trigger = body.due_trigger !== undefined ? body.due_trigger : current.due_trigger;
  const snoozed_until = body.snoozed_until !== undefined ? body.snoozed_until : current.snoozed_until;
  const checklist = body.checklist !== undefined ? body.checklist : current.checklist;
  const links = body.links !== undefined ? body.links : current.links;
  const attachments = body.attachments !== undefined ? body.attachments : current.attachments;

  // Handle status transitions
  let completed_at = current.completed_at;
  if (status === "done" && current.status !== "done") {
    completed_at = new Date().toISOString();
  } else if (status !== "done" && current.status === "done") {
    completed_at = null;
  }

  const result = await query<ActionItem>(
    `UPDATE action_items SET
      title = $2,
      description = $3,
      owner_type = $4,
      person_id = $5,
      source_person_id = $6,
      status = $7,
      priority = $8,
      due_at = $9,
      due_trigger = $10,
      snoozed_until = $11,
      completed_at = $12,
      checklist = $13,
      links = $14,
      attachments = $15,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [
      id, title, description, owner_type, person_id, source_person_id,
      status, priority, due_at, due_trigger, snoozed_until, completed_at,
      JSON.stringify(checklist || []),
      JSON.stringify(links || []),
      JSON.stringify(attachments || []),
    ]
  );

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await query("DELETE FROM action_items WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
