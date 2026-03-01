import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { Project, ProjectMember } from "@/lib/types";

export const GET = withAuth(async (req, { db }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // active, on_hold, completed, archived
  const personId = searchParams.get("person_id");

  let where = "";
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIdx = 1;

  if (status) {
    conditions.push(`p.status = $${paramIdx++}`);
    params.push(status);
  }
  if (personId) {
    conditions.push(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.person_id = $${paramIdx++})`);
    params.push(personId);
  }

  if (conditions.length) {
    where = `WHERE ${conditions.join(" AND ")}`;
  }

  const projects = await db.getMany<Project>(`
    SELECT p.*,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id)::int AS task_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.status = 'done')::int AS done_count,
      (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.status IN ('open', 'in_progress'))::int AS open_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id)::int AS milestone_count,
      (SELECT m.title FROM milestones m WHERE m.project_id = p.id AND m.status != 'completed' ORDER BY m.sort_order LIMIT 1) AS next_milestone
    FROM projects p
    ${where}
    ORDER BY
      CASE p.status
        WHEN 'active' THEN 0
        WHEN 'on_hold' THEN 1
        WHEN 'completed' THEN 2
        WHEN 'archived' THEN 3
      END,
      p.updated_at DESC
  `, params);

  // Attach members to each project
  if (projects.length > 0) {
    const projectIds = projects.map((p) => p.id);
    const members = await db.getMany<ProjectMember>(`
      SELECT pm.*, p.name AS person_name, p.photo_url AS person_photo_url
      FROM project_members pm
      JOIN people p ON p.id = pm.person_id
      WHERE pm.project_id = ANY($1)
      ORDER BY
        CASE pm.role WHEN 'lead' THEN 0 WHEN 'member' THEN 1 WHEN 'stakeholder' THEN 2 WHEN 'client' THEN 3 END,
        p.name
    `, [projectIds]);

    const memberMap = new Map<number, ProjectMember[]>();
    for (const m of members) {
      if (!memberMap.has(m.project_id)) memberMap.set(m.project_id, []);
      memberMap.get(m.project_id)!.push(m);
    }
    for (const proj of projects) {
      (proj as Project).members = memberMap.get(proj.id) || [];
    }
  }

  return NextResponse.json(projects);
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const body = await req.json();
  const { name, description, color, start_date, target_date, member_ids } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await db.query<Project>(
    `INSERT INTO projects (name, description, color, start_date, target_date, org_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      name.trim(),
      description || null,
      color || "#3b82f6",
      start_date || null,
      target_date || null,
      orgId,
    ]
  );

  const project = result.rows[0];

  // Add members if provided
  if (member_ids?.length) {
    for (const { person_id, role } of member_ids) {
      await db.query(
        `INSERT INTO project_members (project_id, person_id, role)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [project.id, person_id, role || "member"]
      );
    }
  }

  return NextResponse.json(project, { status: 201 });
});
