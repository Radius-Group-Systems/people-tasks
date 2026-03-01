import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ActionItem } from "@/lib/types";

export const GET = withAuth(async (req, { db }) => {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  const involvesPersonId = searchParams.get("involves_person_id");
  const ownerType = searchParams.get("owner_type");
  const encounterId = searchParams.get("encounter_id");
  const status = searchParams.get("status") || "open";

  // Auto-resurface: move snoozed items past their snoozed_until date back to open
  await db.query(
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
  const projectId = searchParams.get("project_id");
  if (projectId) {
    conditions.push(`ai.project_id = $${paramIdx++}`);
    params.push(projectId);
  }
  const milestoneId = searchParams.get("milestone_id");
  if (milestoneId) {
    conditions.push(`ai.milestone_id = $${paramIdx++}`);
    params.push(milestoneId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const items = await db.getMany<ActionItem>(`
    SELECT ai.*,
      p.name AS person_name,
      sp.name AS source_person_name,
      e.title AS encounter_title,
      proj.name AS project_name,
      ms.title AS milestone_title,
      CASE WHEN ai.due_trigger = 'next_meeting' AND p.next_meeting_at IS NOT NULL
        THEN p.next_meeting_at
        ELSE NULL
      END AS next_meeting_date
    FROM action_items ai
    LEFT JOIN people p ON p.id = ai.person_id
    LEFT JOIN people sp ON sp.id = ai.source_person_id
    LEFT JOIN encounters e ON e.id = ai.encounter_id
    LEFT JOIN projects proj ON proj.id = ai.project_id
    LEFT JOIN milestones ms ON ms.id = ai.milestone_id
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
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const {
    title, description, owner_type, person_id, source_person_id,
    encounter_id, project_id, milestone_id,
    priority, due_at, due_trigger, checklist, links, attachments
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json({ error: "Title too long (max 500 chars)" }, { status: 400 });
  }
  if (description && description.length > 10000) {
    return NextResponse.json({ error: "Description too long (max 10000 chars)" }, { status: 400 });
  }
  const VALID_PRIORITIES = ["urgent", "high", "normal", "low"];
  const VALID_OWNER_TYPES = ["me", "them"];
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}` }, { status: 400 });
  }
  if (owner_type && !VALID_OWNER_TYPES.includes(owner_type)) {
    return NextResponse.json({ error: `Invalid owner_type. Must be one of: ${VALID_OWNER_TYPES.join(", ")}` }, { status: 400 });
  }

  const result = await db.query<ActionItem>(
    `INSERT INTO action_items (title, description, owner_type, person_id, source_person_id, encounter_id, project_id, milestone_id, priority, due_at, due_trigger, checklist, links, attachments, org_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      title.trim(),
      description || null,
      owner_type || "me",
      person_id || null,
      source_person_id || null,
      encounter_id || null,
      project_id || null,
      milestone_id || null,
      priority || "normal",
      due_at || null,
      due_trigger || null,
      JSON.stringify(checklist || []),
      JSON.stringify(links || []),
      JSON.stringify(attachments || []),
      orgId,
    ]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
});
