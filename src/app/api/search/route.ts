import { NextRequest, NextResponse } from "next/server";
import { semanticSearch } from "@/lib/embeddings";
import { invokeModel } from "@/lib/bedrock";
import { getOne, getMany } from "@/lib/db";
import { ActionItem, Person, Encounter } from "@/lib/types";

/**
 * Hybrid search: handles structured queries (tasks, people, dates) via database
 * AND semantic queries (meeting content, discussions) via vector search + RAG.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "8");

  if (!q?.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const query = q.trim().toLowerCase();

    // Gather structured data from the database if the query seems task/people-oriented
    const structuredContext = await gatherStructuredContext(query);

    // Also do semantic search for meeting/transcript content
    let semanticSources: {
      source_type: string;
      source_id: number;
      chunk_text: string;
      similarity: number;
      title?: string;
      url?: string;
    }[] = [];

    try {
      const chunks = await semanticSearch(q, limit, 0.2);
      const seenEncounters = new Set<number>();
      for (const chunk of chunks) {
        const encounterId =
          (chunk.metadata?.encounter_id as number) || chunk.source_id;
        let title = chunk.metadata?.title as string | undefined;
        let url: string | undefined;

        if (
          (chunk.source_type === "transcript" || chunk.source_type === "summary") &&
          !seenEncounters.has(encounterId)
        ) {
          if (!title) {
            const enc = await getOne<{ title: string }>(
              "SELECT title FROM encounters WHERE id = $1",
              [encounterId]
            );
            title = enc?.title;
          }
          url = `/encounters/${encounterId}`;
          seenEncounters.add(encounterId);
        }

        semanticSources.push({
          ...chunk,
          title: title || `${chunk.source_type} #${chunk.source_id}`,
          url,
        });
      }
    } catch {
      // Semantic search is optional — may fail if no embeddings exist
    }

    // Build context for Claude to synthesize an answer
    const contextParts: string[] = [];

    if (structuredContext) {
      contextParts.push(structuredContext);
    }

    if (semanticSources.length > 0) {
      const transcriptContext = semanticSources
        .map(
          (s, i) =>
            `[Meeting source ${i + 1}: ${s.title}]\n${s.chunk_text}`
        )
        .join("\n\n---\n\n");
      contextParts.push(`MEETING TRANSCRIPTS AND NOTES:\n\n${transcriptContext}`);
    }

    // Synthesize answer with Claude
    let answer: string | null = null;
    if (contextParts.length > 0) {
      const context = contextParts.join("\n\n===\n\n");
      const today = new Date();
      const todayStr = today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const systemPrompt = `You are a helpful assistant for a personal task/people management app. You answer questions based on the user's actual data: tasks, people, meetings, and notes.

Today is ${todayStr}.

Answer concisely and helpfully based on the provided context. Format with markdown.
- For task-related questions, list the specific tasks with their status, person, and due dates
- For people-related questions, reference the specific people and their involvement
- For meeting-related questions, reference the specific meetings
- If the data doesn't fully answer the question, say what you can and note what's missing
- Use bullet points for lists of items`;

      const userMessage = `Data from my task manager:\n\n${context}\n\n---\n\nQuestion: ${q}`;

      try {
        answer = await invokeModel(systemPrompt, userMessage, {
          maxTokens: 1024,
          temperature: 0.3,
        });
      } catch (err) {
        console.error("Answer synthesis failed:", err);
      }
    }

    return NextResponse.json({
      answer,
      sources: semanticSources.map((s) => ({
        source_type: s.source_type,
        source_id: s.source_id,
        title: s.title,
        url: s.url,
        similarity: Math.round(s.similarity * 100),
        excerpt:
          s.chunk_text.length > 200
            ? s.chunk_text.slice(0, 200) + "..."
            : s.chunk_text,
      })),
      query: q,
    });
  } catch (err) {
    console.error("Search failed:", err);
    return NextResponse.json(
      { error: "Search failed. Check Bedrock configuration." },
      { status: 500 }
    );
  }
}

/**
 * Query the database for structured data relevant to the search query.
 * Returns a formatted string of results, or null if no structured data is relevant.
 */
async function gatherStructuredContext(query: string): Promise<string | null> {
  const parts: string[] = [];

  const isTaskQuery = /task|due|overdue|deadline|todo|action item|checklist|open|waiting|assigned|snoozed|in progress/i.test(query);
  const isPeopleQuery = /who|person|people|team|contact|everyone/i.test(query);
  const isMeetingQuery = /meeting|encounter|met|conversation|last met|discussed/i.test(query);
  const isTimeQuery = /today|this week|next week|this month|upcoming|overdue|past due|soon/i.test(query);

  // Always fetch tasks for task-related or time-related queries
  if (isTaskQuery || isTimeQuery) {
    // Open tasks with due dates
    const openTasks = await getMany<ActionItem>(`
      SELECT ai.*, p.name AS person_name, sp.name AS source_person_name
      FROM action_items ai
      LEFT JOIN people p ON p.id = ai.person_id
      LEFT JOIN people sp ON sp.id = ai.source_person_id
      WHERE ai.status IN ('open', 'in_progress')
      ORDER BY ai.due_at ASC NULLS LAST, ai.priority = 'urgent' DESC, ai.created_at DESC
      LIMIT 50
    `);

    if (openTasks.length > 0) {
      const taskLines = openTasks.map((t) => {
        const duePart = t.due_at
          ? `due ${new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : t.due_trigger === "next_meeting" ? "due next meeting" : "no deadline";
        const personPart = t.person_name ? ` (${t.owner_type === "me" ? "for" : "from"} ${t.person_name})` : "";
        const sourcePart = t.source_person_name ? ` [requested by ${t.source_person_name}]` : "";
        const statusPart = t.status === "in_progress" ? " [in progress]" : "";
        const priorityPart = t.priority !== "normal" ? ` [${t.priority}]` : "";
        const checklistPart = t.checklist?.length > 0
          ? ` — ${t.checklist.filter(c => c.done).length}/${t.checklist.length} subtasks done`
          : "";
        return `- ${t.title}${personPart}${sourcePart} — ${duePart}${statusPart}${priorityPart}${checklistPart}`;
      });
      parts.push(`OPEN TASKS (${openTasks.length}):\n${taskLines.join("\n")}`);
    }

    // Snoozed tasks
    const snoozedTasks = await getMany<ActionItem>(`
      SELECT ai.*, p.name AS person_name
      FROM action_items ai
      LEFT JOIN people p ON p.id = ai.person_id
      WHERE ai.status = 'snoozed'
      ORDER BY ai.snoozed_until ASC
      LIMIT 20
    `);

    if (snoozedTasks.length > 0) {
      const snoozedLines = snoozedTasks.map((t) => {
        const until = t.snoozed_until
          ? `until ${new Date(t.snoozed_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "";
        return `- ${t.title} ${until}`;
      });
      parts.push(`SNOOZED TASKS (${snoozedTasks.length}):\n${snoozedLines.join("\n")}`);
    }

    // Waiting on (them) tasks
    const waitingTasks = await getMany<ActionItem>(`
      SELECT ai.*, p.name AS person_name
      FROM action_items ai
      LEFT JOIN people p ON p.id = ai.person_id
      WHERE ai.owner_type = 'them' AND ai.status IN ('open', 'in_progress')
      ORDER BY ai.created_at DESC
      LIMIT 30
    `);

    if (waitingTasks.length > 0) {
      const waitingLines = waitingTasks.map((t) => {
        const personPart = t.person_name || "unknown";
        const duePart = t.due_at
          ? ` — due ${new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "";
        return `- ${t.title} (waiting on ${personPart})${duePart}`;
      });
      parts.push(`WAITING ON OTHERS (${waitingTasks.length}):\n${waitingLines.join("\n")}`);
    }
  }

  // People data
  if (isPeopleQuery || isTaskQuery) {
    const people = await getMany<Person & { open_items_count: number; waiting_on_count: number; encounter_count: number }>(`
      SELECT p.name, p.organization,
        COUNT(CASE WHEN ai.owner_type = 'me' AND ai.status = 'open' THEN 1 END)::int AS open_items_count,
        COUNT(CASE WHEN ai.owner_type = 'them' AND ai.status = 'open' THEN 1 END)::int AS waiting_on_count
      FROM people p
      LEFT JOIN action_items ai ON ai.person_id = p.id OR ai.source_person_id = p.id
      GROUP BY p.id
      ORDER BY p.name
    `);

    if (people.length > 0) {
      const personLines = people.map((p) => {
        const org = p.organization ? ` (${p.organization})` : "";
        const tasks = p.open_items_count > 0 ? `, ${p.open_items_count} tasks for me` : "";
        const waiting = p.waiting_on_count > 0 ? `, ${p.waiting_on_count} waiting on them` : "";
        return `- ${p.name}${org}${tasks}${waiting}`;
      });
      parts.push(`PEOPLE (${people.length}):\n${personLines.join("\n")}`);
    }
  }

  // Recent meetings
  if (isMeetingQuery) {
    const encounters = await getMany<Encounter>(`
      SELECT e.id, e.title, e.occurred_at, e.encounter_type, e.summary
      FROM encounters e
      ORDER BY e.occurred_at DESC
      LIMIT 15
    `);

    if (encounters.length > 0) {
      const meetingLines = encounters.map((e) => {
        const date = new Date(e.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const summaryPart = e.summary ? ` — ${e.summary.slice(0, 100)}...` : "";
        return `- ${e.title} (${date}, ${e.encounter_type})${summaryPart}`;
      });
      parts.push(`RECENT MEETINGS (${encounters.length}):\n${meetingLines.join("\n")}`);
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
