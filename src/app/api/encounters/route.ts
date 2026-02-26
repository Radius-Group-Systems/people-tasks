import { NextRequest, NextResponse } from "next/server";
import { getMany, query } from "@/lib/db";
import { Encounter } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");

  let encounters: Encounter[];

  if (personId) {
    encounters = await getMany<Encounter>(`
      SELECT e.*
      FROM encounters e
      JOIN encounter_participants ep ON ep.encounter_id = e.id
      WHERE ep.person_id = $1
      ORDER BY e.occurred_at DESC
    `, [personId]);
  } else {
    encounters = await getMany<Encounter>(`
      SELECT * FROM encounters ORDER BY occurred_at DESC
    `);
  }

  return NextResponse.json(encounters);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title, encounter_type, occurred_at, summary,
    raw_transcript, source, source_file_path
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await query<Encounter>(
    `INSERT INTO encounters (title, encounter_type, occurred_at, summary, raw_transcript, source, source_file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      title.trim(),
      encounter_type || "meeting",
      occurred_at || new Date().toISOString(),
      summary || null,
      raw_transcript || null,
      source || "manual",
      source_file_path || null,
    ]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}
