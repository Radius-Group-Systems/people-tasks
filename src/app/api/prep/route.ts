import { NextRequest, NextResponse } from "next/server";
import { getOne, getMany } from "@/lib/db";
import { Person, ActionItem, Encounter } from "@/lib/types";
import { semanticSearch } from "@/lib/embeddings";

/**
 * GET /api/prep?person_id=5
 * Returns everything needed for meeting prep with a person:
 * - Person info
 * - Open action items (both directions)
 * - Recent encounters
 * - Related context from other meetings (via semantic search)
 */
export async function GET(req: NextRequest) {
  const personId = req.nextUrl.searchParams.get("person_id");
  if (!personId) {
    return NextResponse.json({ error: "person_id is required" }, { status: 400 });
  }

  const person = await getOne<Person>(
    "SELECT * FROM people WHERE id = $1",
    [personId]
  );
  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  // Open items I need to do for this person
  const myOpenItems = await getMany<ActionItem>(
    `SELECT ai.*, p.name AS person_name, sp.name AS source_person_name,
      CASE WHEN ai.due_trigger = 'next_meeting' AND p.next_meeting_at IS NOT NULL
        THEN p.next_meeting_at ELSE NULL END AS next_meeting_date
     FROM action_items ai
     LEFT JOIN people p ON p.id = ai.person_id
     LEFT JOIN people sp ON sp.id = ai.source_person_id
     WHERE (ai.person_id = $1 OR ai.source_person_id = $1) AND ai.owner_type = 'me' AND ai.status IN ('open', 'in_progress')
     ORDER BY CASE ai.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
              COALESCE(ai.due_at, CASE WHEN ai.due_trigger = 'next_meeting' THEN p.next_meeting_at END) ASC NULLS LAST`,
    [personId]
  );

  // Open items they need to do (what I'm waiting on)
  const theirOpenItems = await getMany<ActionItem>(
    `SELECT ai.*, p.name AS person_name, sp.name AS source_person_name,
      CASE WHEN ai.due_trigger = 'next_meeting' AND p.next_meeting_at IS NOT NULL
        THEN p.next_meeting_at ELSE NULL END AS next_meeting_date
     FROM action_items ai
     LEFT JOIN people p ON p.id = ai.person_id
     LEFT JOIN people sp ON sp.id = ai.source_person_id
     WHERE (ai.person_id = $1 OR ai.source_person_id = $1) AND ai.owner_type = 'them' AND ai.status IN ('open', 'in_progress')
     ORDER BY CASE ai.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
              COALESCE(ai.due_at, CASE WHEN ai.due_trigger = 'next_meeting' THEN p.next_meeting_at END) ASC NULLS LAST`,
    [personId]
  );

  // Recent encounters with this person (last 5)
  const recentEncounters = await getMany<Encounter>(
    `SELECT e.* FROM encounters e
     JOIN encounter_participants ep ON ep.encounter_id = e.id
     WHERE ep.person_id = $1
     ORDER BY e.occurred_at DESC
     LIMIT 5`,
    [personId]
  );

  // Semantic search for related context (mentions of this person in other meetings)
  let relatedContext: { title: string; excerpt: string; encounter_id: number }[] = [];
  try {
    const searchResults = await semanticSearch(person.name, 5, 0.25);
    // Deduplicate by encounter and exclude encounters already listed
    const recentIds = new Set(recentEncounters.map((e) => e.id));
    const seen = new Set<number>();
    for (const result of searchResults) {
      const encId = (result.metadata?.encounter_id as number) || result.source_id;
      if (seen.has(encId) || recentIds.has(encId)) continue;
      seen.add(encId);
      const title = (result.metadata?.title as string) || `Encounter #${encId}`;
      relatedContext.push({
        title,
        excerpt: result.chunk_text.length > 300
          ? result.chunk_text.slice(0, 300) + "..."
          : result.chunk_text,
        encounter_id: encId,
      });
    }
  } catch {
    // Semantic search is optional — fail silently
  }

  return NextResponse.json({
    person,
    my_open_items: myOpenItems,
    their_open_items: theirOpenItems,
    recent_encounters: recentEncounters,
    related_context: relatedContext,
  });
}
