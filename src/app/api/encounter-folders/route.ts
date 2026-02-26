import { NextRequest, NextResponse } from "next/server";
import { getMany, query } from "@/lib/db";
import { EncounterFolder } from "@/lib/types";

export async function GET() {
  const folders = await getMany<EncounterFolder>(
    "SELECT * FROM encounter_folders ORDER BY name"
  );
  return NextResponse.json(folders);
}

export async function POST(req: NextRequest) {
  const { name, color, parent_id } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await query<EncounterFolder>(
    `INSERT INTO encounter_folders (name, color, parent_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name.trim(), color || "#6b7280", parent_id || null]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, name, color } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const result = await query<EncounterFolder>(
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
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Unlink encounters from folder before deleting
  await query("UPDATE encounters SET folder_id = NULL WHERE folder_id = $1", [id]);
  await query("DELETE FROM encounter_folders WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
}
