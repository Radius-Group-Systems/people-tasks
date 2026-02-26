"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchIcon, Loader2Icon, FileTextIcon, ExternalLinkIcon } from "lucide-react";

interface SearchSource {
  source_type: string;
  source_id: number;
  title: string;
  url?: string;
  similarity: number;
  excerpt: string;
}

interface SearchResult {
  answer: string | null;
  sources: SearchSource[];
  query: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Search failed");
      }
      const data: SearchResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  const sourceTypeLabel: Record<string, string> = {
    transcript: "Meeting",
    summary: "Summary",
    action_item: "Task",
    note: "Note",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your meetings, tasks, or people..."
            className="pl-10"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {searching && (
        <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
          <Loader2Icon className="w-5 h-5 animate-spin" />
          <span>Searching across your meetings and notes...</span>
        </div>
      )}

      {result && !searching && (
        <div className="space-y-6">
          {/* AI Answer */}
          {result.answer && (
            <Card>
              <CardContent className="pt-5">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result.answer) }} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Sources ({result.sources.length})
              </h2>
              <div className="space-y-2">
                {result.sources.map((source, i) => (
                  <Card key={`${source.source_type}-${source.source_id}-${i}`} className="hover:border-primary/30 transition-colors">
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <FileTextIcon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {source.url ? (
                              <a
                                href={source.url}
                                className="text-sm font-medium hover:text-primary hover:underline transition-colors flex items-center gap-1"
                              >
                                {source.title}
                                <ExternalLinkIcon className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-sm font-medium">{source.title}</span>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {sourceTypeLabel[source.source_type] || source.source_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {source.similarity}% match
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {source.excerpt}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {result.sources.length === 0 && !result.answer && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No results found for &ldquo;{result.query}&rdquo;</p>
              <p className="text-sm mt-1">Try rephrasing your question or importing more transcripts.</p>
            </div>
          )}
        </div>
      )}

      {!result && !searching && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Search across your tasks, people, meetings, and notes.</p>
          <p className="text-sm mt-2">Try questions like:</p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["What tasks are due this week?", "What am I waiting on?", "Who has the most open items?", "What did we discuss about the website?"].map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple markdown to HTML (bold, italic, lists, links, paragraphs) */
function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`(.+?)`/g, "<code>$1</code>")
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    // Single newlines within paragraphs
    .replace(/\n/g, "<br>");
}
