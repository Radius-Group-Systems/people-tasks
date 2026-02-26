import { NextRequest, NextResponse } from "next/server";
import { semanticSearch } from "@/lib/embeddings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "10");

  if (!q?.trim()) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const results = await semanticSearch(q, limit);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Search failed:", err);
    return NextResponse.json(
      { error: "Search failed. Check Bedrock configuration." },
      { status: 500 }
    );
  }
}
