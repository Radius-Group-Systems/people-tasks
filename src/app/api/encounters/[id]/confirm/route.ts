import { NextRequest, NextResponse } from "next/server";
import { getOne, getMany, query } from "@/lib/db";
import { Encounter, ActionItem } from "@/lib/types";
import { embedEncounter } from "@/lib/embeddings";

interface ConfirmItem {
  title: string;
  description?: string | null;
  owner_type: "me" | "them";
  person_name?: string | null;
  person_id?: number | null;
  priority?: string;
  due_hint?: string | null;
}

/**
 * POST /api/encounters/[id]/confirm
 * Save reviewed/edited action items from AI extraction.
 * Also links participants to the encounter.
 *
 * Body: {
 *   items: ConfirmItem[],           // action items to create
 *   participants: string[],         // people names to link
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encounterId = parseInt(id);

  const encounter = await getOne<Encounter>(
    "SELECT * FROM encounters WHERE id = $1",
    [encounterId]
  );
  if (!encounter) {
    return NextResponse.json({ error: "Encounter not found" }, { status: 404 });
  }

  const body = await req.json();
  const { items, participants }: { items: ConfirmItem[]; participants: string[] } = body;

  // Resolve participant names to person IDs and link them
  if (participants?.length) {
    const people = await getMany<{ id: number; name: string }>(
      "SELECT id, name FROM people"
    );
    const nameMap = new Map(
      people.map((p) => [p.name.toLowerCase(), p.id])
    );

    for (const name of participants) {
      let personId = nameMap.get(name.toLowerCase());

      // Auto-create person if not found
      if (!personId) {
        const result = await query<{ id: number }>(
          "INSERT INTO people (name) VALUES ($1) RETURNING id",
          [name]
        );
        personId = result.rows[0].id;
      }

      // Link participant (ignore duplicates)
      await query(
        `INSERT INTO encounter_participants (encounter_id, person_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [encounterId, personId]
      );
    }
  }

  // Resolve person names in items and create action items
  const createdItems: ActionItem[] = [];

  if (items?.length) {
    const people = await getMany<{ id: number; name: string }>(
      "SELECT id, name FROM people"
    );
    const nameMap = new Map(
      people.map((p) => [p.name.toLowerCase(), p.id])
    );

    for (const item of items) {
      // Resolve person_id from name if not explicitly provided
      let personId = item.person_id ?? null;
      if (!personId && item.person_name) {
        personId = nameMap.get(item.person_name.toLowerCase()) ?? null;
      }

      // Parse due_hint into due_at / due_trigger
      let dueAt: string | null = null;
      let dueTrigger: string | null = null;

      if (item.due_hint) {
        const hint = item.due_hint.toLowerCase();
        if (hint.includes("next meeting")) {
          dueTrigger = "next_meeting";
        } else {
          // Try to parse as a date
          const parsed = Date.parse(item.due_hint);
          if (!isNaN(parsed)) {
            dueAt = new Date(parsed).toISOString();
            dueTrigger = "date";
          }
          // Otherwise just store as description context
        }
      }

      const result = await query<ActionItem>(
        `INSERT INTO action_items
          (title, description, owner_type, person_id, encounter_id, priority, due_at, due_trigger, checklist, links, attachments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]', '[]', '[]')
         RETURNING *`,
        [
          item.title,
          item.description || null,
          item.owner_type || "me",
          personId,
          encounterId,
          item.priority || "normal",
          dueAt,
          dueTrigger,
        ]
      );
      createdItems.push(result.rows[0]);
    }
  }

  // Embed the transcript in the background (don't block the response)
  let chunksEmbedded = 0;
  try {
    chunksEmbedded = await embedEncounter(encounterId);
  } catch (err) {
    console.error("Embedding failed (non-blocking):", err);
  }

  return NextResponse.json({
    encounter_id: encounterId,
    items_created: createdItems.length,
    chunks_embedded: chunksEmbedded,
    items: createdItems,
  });
}
