import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { EncounterFolder } from "@/lib/types";

export const GET = withAuth(async (req, { db }) => {
  const folders = await db.getMany<EncounterFolder>(
    "SELECT * FROM encounter_folders ORDER BY name"
  );
  return NextResponse.json(folders);
});

export const POST = withAuth(async (req, { db, orgId }) => {
  const { name, color, parent_id } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await db.query<EncounterFolder>(
    `INSERT INTO encounter_folders (name, color, parent_id, org_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name.trim(), color || "#6b7280", parent_id || null, orgId]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
});

export const PATCH = withAuth(async (req, { db }) => {
  const { id, name, color } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const result = await db.query<EncounterFolder>(
    `UPDATE encounter_folders
     SET name = COALESCE($2, name), color = COALESCE($3, color)
     WHERE id = $1
     RETURNING *`,
    [id, name || null, color || null]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
});

export const DELETE = withAuth(async (req, { db }) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Unlink encounters from folder before deleting
  await db.query("UPDATE encounters SET folder_id = NULL WHERE folder_id = $1", [id]);
  await db.query("DELETE FROM encounter_folders WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
});
