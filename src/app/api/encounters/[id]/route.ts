import { NextRequest, NextResponse } from "next/server";
import { getOne, getMany } from "@/lib/db";
import { Encounter, Person } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encounter = await getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [id]
  );

  if (!encounter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch participants
  const participants = await getMany<Person>(
    `SELECT p.* FROM people p
     JOIN encounter_participants ep ON ep.person_id = p.id
     WHERE ep.encounter_id = $1
     ORDER BY p.name`,
    [id]
  );

  return NextResponse.json({ ...encounter, participants });
}
