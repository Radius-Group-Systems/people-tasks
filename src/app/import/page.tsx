"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportPage() {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Meeting",
          encounter_type: "meeting",
          occurred_at: new Date().toISOString(),
          raw_transcript: transcript,
          summary: summary || null,
          source: "plaud",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(`Encounter saved (ID: ${data.id}). AI processing will be added in Sprint 2.`);
        setTitle("");
        setTranscript("");
        setSummary("");
      } else {
        setResult("Failed to save encounter.");
      }
    } catch (err) {
      console.error(err);
      setResult("Error saving encounter.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTranscript(text);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Meeting</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Plaud Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly sync with Josiah"
              />
            </div>

            <div>
              <Label htmlFor="file">Upload File</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.md,.text"
                onChange={handleFileUpload}
              />
            </div>

            <div>
              <Label htmlFor="transcript">Or Paste Transcript</Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your meeting transcript here..."
                rows={12}
              />
            </div>

            <div>
              <Label htmlFor="summary">Summary (optional)</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Paste the Plaud summary if available..."
                rows={4}
              />
            </div>

            <Button type="submit" disabled={submitting || !transcript.trim()}>
              {submitting ? "Saving..." : "Import Meeting"}
            </Button>

            {result && (
              <p className="text-sm text-muted-foreground">{result}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
