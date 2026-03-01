import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Project, ProjectMember, Milestone, ActionItem, Encounter } from "@/lib/types";

export const GET = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const project = await db.getOne<Project>(
    `SELECT p.*,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id)::int AS task_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.status = 'done')::int AS done_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.status IN ('open', 'in_progress'))::int AS open_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id)::int AS milestone_count
    FROM projects p
    WHERE p.id = $1`,
    [id]
  );

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch members
  const members = await db.getMany<ProjectMember>(`
    SELECT pm.*, p.name AS person_name, p.photo_url AS person_photo_url
    FROM project_members pm
    JOIN people p ON p.id = pm.person_id
    WHERE pm.project_id = $1
    ORDER BY
      CASE pm.role WHEN 'lead' THEN 0 WHEN 'member' THEN 1 WHEN 'stakeholder' THEN 2 WHEN 'client' THEN 3 END,
      p.name
  `, [id]);

  // Fetch milestones with task counts
  const milestones = await db.getMany<Milestone>(`
    SELECT m.*,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.milestone_id = m.id)::int AS task_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.milestone_id = m.id AND ai.status = 'done')::int AS done_count
    FROM milestones m
    WHERE m.project_id = $1
    ORDER BY m.sort_order, m.created_at
  `, [id]);

  // Fetch tasks (limited recent set)
  const tasks = await db.getMany<ActionItem>(`
    SELECT ai.*, p.name AS person_name, sp.name AS source_person_name, m.title AS milestone_title
    FROM action_items ai
    LEFT JOIN people p ON p.id = ai.person_id
    LEFT JOIN people sp ON sp.id = ai.source_person_id
    LEFT JOIN milestones m ON m.id = ai.milestone_id
    WHERE ai.project_id = $1
    ORDER BY
      CASE ai.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'snoozed' THEN 2 WHEN 'done' THEN 3 WHEN 'cancelled' THEN 4 END,
      CASE ai.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
      ai.created_at DESC
  `, [id]);

  // Fetch linked encounters
  const encounters = await db.getMany<Encounter>(`
    SELECT e.id, e.title, e.encounter_type, e.occurred_at, e.summary, e.source
    FROM encounters e
    WHERE e.project_id = $1
    ORDER BY e.occurred_at DESC
    LIMIT 20
  `, [id]);

  return NextResponse.json({
    ...project,
    members,
    milestones,
    tasks,
    encounters,
  });
});

export const PATCH = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();

  const existing = await db.getOne<Project>(
    "SELECT * FROM projects WHERE id = $1",
    [id]
  );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await db.query<Project>(
    `UPDATE projects SET
      name = $2,
      description = $3,
      status = $4,
      color = $5,
      start_date = $6,
      target_date = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`,
    [
      id,
      body.name !== undefined ? body.name : existing.name,
      body.description !== undefined ? body.description : existing.description,
      body.status !== undefined ? body.status : existing.status,
      body.color !== undefined ? body.color : existing.color,
      body.start_date !== undefined ? body.start_date : existing.start_date,
      body.target_date !== undefined ? body.target_date : existing.target_date,
    ]
  );

  return NextResponse.json(result.rows[0]);
});

export const DELETE = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  // Unlink tasks and encounters (don't delete them)
  await db.query("UPDATE action_items SET project_id = NULL, milestone_id = NULL WHERE project_id = $1", [id]);
  await db.query("UPDATE encounters SET project_id = NULL WHERE project_id = $1", [id]);

  // Delete project (cascades to members and milestones)
  await db.query("DELETE FROM projects WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
});
