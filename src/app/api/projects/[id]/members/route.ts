import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { ProjectMember } from "@/lib/types";

export const GET = withAuth(async (_req, { db }, params) => {
  const id = params!.id;

  const members = await db.getMany<ProjectMember>(`
    SELECT pm.*, p.name AS person_name, p.photo_url AS person_photo_url
    FROM project_members pm
    JOIN people p ON p.id = pm.person_id
    WHERE pm.project_id = $1
    ORDER BY
      CASE pm.role WHEN 'lead' THEN 0 WHEN 'member' THEN 1 WHEN 'stakeholder' THEN 2 WHEN 'client' THEN 3 END,
      p.name
  `, [id]);

  return NextResponse.json(members);
});

/**
 * POST /api/projects/[id]/members
 * Body: { person_id: number, role?: string }
 */
export const POST = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const body = await req.json();
  const { person_id, role } = body;

  if (!person_id) {
    return NextResponse.json({ error: "person_id is required" }, { status: 400 });
  }

  await db.query(
    `INSERT INTO project_members (project_id, person_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, person_id) DO UPDATE SET role = $3`,
    [id, person_id, role || "member"]
  );

  return NextResponse.json({ success: true }, { status: 201 });
});

/**
 * DELETE /api/projects/[id]/members
 * Query: ?person_id=123
 */
export const DELETE = withAuth(async (req, { db }, params) => {
  const id = params!.id;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");

  if (!personId) {
    return NextResponse.json({ error: "person_id is required" }, { status: 400 });
  }

  await db.query(
    "DELETE FROM project_members WHERE project_id = $1 AND person_id = $2",
    [id, personId]
  );

  return NextResponse.json({ success: true });
});
