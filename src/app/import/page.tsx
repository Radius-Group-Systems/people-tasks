"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ImportPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [encounterType, setEncounterType] = useState("meeting");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16) // datetime-local format
  );
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [step, setStep] = useState<"input" | "processing">("input");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;

    setStep("processing");
    setError(null);

    try {
      // 1. Save the encounter
      const encounterRes = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Meeting",
          encounter_type: encounterType,
          occurred_at: new Date(occurredAt).toISOString(),
          raw_transcript: transcript,
          summary: summary || null,
          source: "plaud",
        }),
      });

      if (!encounterRes.ok) {
        throw new Error("Failed to save encounter");
      }

      const encounter = await encounterRes.json();

      // 2. Redirect to review page, which will trigger extraction
      router.push(`/review/${encounter.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to save encounter. Please try again.");
      setStep("input");
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
          <CardTitle>Upload Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "processing" ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Saving encounter...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="type">Type</Label>
                  <Select value={encounterType} onValueChange={setEncounterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="occurred">When</Label>
                <Input
                  id="occurred"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
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
                <Label htmlFor="summary">Summary (optional — Plaud provides one)</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Paste the Plaud summary if available..."
                  rows={4}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button type="submit" disabled={!transcript.trim()}>
                Import &amp; Extract Action Items
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
