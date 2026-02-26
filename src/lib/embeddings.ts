import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { query, getMany } from "./db";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2",
});

const EMBED_MODEL = "amazon.titan-embed-text-v2:0";
const CHUNK_SIZE = 1500; // chars per chunk (well under 8k token limit)
const CHUNK_OVERLAP = 200;

/**
 * Generate a 1024-dim embedding for a text string via Titan V2.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: EMBED_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
    }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding;
}

/**
 * Split text into overlapping chunks for embedding.
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  // Split on paragraph boundaries first
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Keep overlap from end of previous chunk
      const words = current.split(/\s+/);
      const overlapWords = [];
      let overlapLen = 0;
      for (let i = words.length - 1; i >= 0 && overlapLen < CHUNK_OVERLAP; i--) {
        overlapWords.unshift(words[i]);
        overlapLen += words[i].length + 1;
      }
      current = overlapWords.join(" ") + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If text had no paragraph breaks, fall back to character splitting
  if (chunks.length === 0 && text.trim()) {
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + CHUNK_SIZE).trim());
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  }

  return chunks;
}

/**
 * Embed and store chunks for a source (transcript, action_item, etc).
 * Deletes any previous embeddings for the same source first.
 */
export async function embedSource(
  sourceType: string,
  sourceId: number,
  text: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  // Clear old embeddings for this source
  await query(
    "DELETE FROM embeddings WHERE source_type = $1 AND source_id = $2",
    [sourceType, sourceId]
  );

  const chunks = chunkText(text);
  let stored = 0;

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);

    await query(
      `INSERT INTO embeddings (source_type, source_id, chunk_text, embedding, metadata)
       VALUES ($1, $2, $3, $4::vector, $5)`,
      [
        sourceType,
        sourceId,
        chunk,
        `[${embedding.join(",")}]`,
        JSON.stringify({ ...metadata, chunk_index: stored }),
      ]
    );
    stored++;
  }

  return stored;
}

/**
 * Embed an encounter's transcript + summary.
 */
export async function embedEncounter(encounterId: number): Promise<number> {
  const encounter = await getMany<{
    title: string;
    raw_transcript: string | null;
    summary: string | null;
  }>(
    "SELECT title, raw_transcript, summary FROM encounters WHERE id = $1",
    [encounterId]
  );

  if (!encounter[0]) return 0;
  const { title, raw_transcript, summary } = encounter[0];

  let totalChunks = 0;

  // Embed the transcript
  if (raw_transcript?.trim()) {
    const prefixed = `Meeting: ${title}\n\n${raw_transcript}`;
    totalChunks += await embedSource("transcript", encounterId, prefixed, {
      encounter_id: encounterId,
      title,
    });
  }

  // Embed the summary as a separate source for better retrieval
  if (summary?.trim()) {
    totalChunks += await embedSource("summary", encounterId, `Meeting: ${title}\n\nSummary: ${summary}`, {
      encounter_id: encounterId,
      title,
    });
  }

  return totalChunks;
}

/**
 * Semantic search: find chunks similar to a query string.
 */
export async function semanticSearch(
  queryText: string,
  limit = 10,
  threshold = 0.25
): Promise<
  {
    source_type: string;
    source_id: number;
    chunk_text: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }[]
> {
  const queryEmbedding = await generateEmbedding(queryText);

  const results = await getMany<{
    source_type: string;
    source_id: number;
    chunk_text: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>(
    `SELECT source_type, source_id, chunk_text, metadata,
       1 - (embedding <=> $1::vector) AS similarity
     FROM embeddings
     WHERE 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [`[${queryEmbedding.join(",")}]`, threshold, limit]
  );

  return results;
}
