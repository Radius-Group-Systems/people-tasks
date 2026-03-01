import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ActionItem } from "@/lib/types";

export const PATCH = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();

  // Fetch current item so we can merge
  const current = await db.getOne<ActionItem>(
    "SELECT * FROM action_items WHERE id = $1",
    [id]
  );
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const VALID_STATUSES = ["open", "in_progress", "snoozed", "done"];
  const VALID_PRIORITIES = ["urgent", "high", "normal", "low"];
  const VALID_OWNER_TYPES = ["me", "them"];

  if (body.title && body.title.length > 500) {
    return NextResponse.json({ error: "Title too long (max 500 chars)" }, { status: 400 });
  }
  if (body.description && body.description.length > 10000) {
    return NextResponse.json({ error: "Description too long (max 10000 chars)" }, { status: 400 });
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` }, { status: 400 });
  }
  if (body.owner_type && !VALID_OWNER_TYPES.includes(body.owner_type)) {
    return NextResponse.json({ error: `Invalid owner_type. Must be one of: ${VALID_OWNER_TYPES.join(", ")}` }, { status: 400 });
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
  const sent_via = body.sent_via !== undefined ? body.sent_via : current.sent_via;
  const sent_at = body.sent_at !== undefined ? body.sent_at : current.sent_at;
  const checklist = body.checklist !== undefined ? body.checklist : current.checklist;
  const links = body.links !== undefined ? body.links : current.links;
  const attachments = body.attachments !== undefined ? body.attachments : current.attachments;
  const project_id = body.project_id !== undefined ? body.project_id : current.project_id;
  const milestone_id = body.milestone_id !== undefined ? body.milestone_id : current.milestone_id;

  // Handle status transitions
  let completed_at = current.completed_at;
  if (status === "done" && current.status !== "done") {
    completed_at = new Date().toISOString();
  } else if (status !== "done" && current.status === "done") {
    completed_at = null;
  }

  const result = await db.query<ActionItem>(
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
      sent_via = $13,
      sent_at = $14,
      checklist = $15,
      links = $16,
      attachments = $17,
      project_id = $18,
      milestone_id = $19,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [
      id, title, description, owner_type, person_id, source_person_id,
      status, priority, due_at, due_trigger, snoozed_until, completed_at,
      sent_via, sent_at,
      JSON.stringify(checklist || []),
      JSON.stringify(links || []),
      JSON.stringify(attachments || []),
      project_id,
      milestone_id,
    ]
  );

  return NextResponse.json(result.rows[0]);
});

export const DELETE = withAuth(async (_req, { db }, params) => {
  const id = params!.id;
  const result = await db.query("DELETE FROM action_items WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
