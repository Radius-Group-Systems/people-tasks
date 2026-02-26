"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UploadIcon, XIcon, UserPlusIcon } from "lucide-react";
import { Person } from "@/lib/types";

const DRAFT_KEY = "import-draft";
const MY_PERSON_KEY = "my-person-id";

interface Draft {
  title: string;
  encounterType: string;
  occurredAt: string;
  transcript: string;
  fileName: string | null;
  selectedPeopleIds: number[];
  savedAt: number;
}

export default function ImportPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [encounterType, setEncounterType] = useState("meeting");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [transcript, setTranscript] = useState("");
  const [step, setStep] = useState<"input" | "processing">("input");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const initialized = useRef(false);

  // Load people + restore draft on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    fetch("/api/people")
      .then((r) => r.json())
      .then((loadedPeople: Person[]) => {
        setPeople(loadedPeople);

        // Restore draft from localStorage
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft: Draft = JSON.parse(raw);
            // Only restore if less than 24h old
            if (Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
              setTitle(draft.title);
              setEncounterType(draft.encounterType);
              setOccurredAt(draft.occurredAt);
              setTranscript(draft.transcript);
              setFileName(draft.fileName);
              // Resolve person IDs back to objects
              if (draft.selectedPeopleIds?.length) {
                const restored = draft.selectedPeopleIds
                  .map((id) => loadedPeople.find((p) => p.id === id))
                  .filter(Boolean) as Person[];
                setSelectedPeople(restored);
              }
              setDraftRestored(true);
              if (draft.transcript || draft.title) {
                setShowDraftNotice(true);
              }
            } else {
              localStorage.removeItem(DRAFT_KEY);
            }
          }
        } catch {
          // ignore
        }
      })
      .catch(console.error);
  }, []);

  // Save draft to localStorage on changes (debounced)
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      const draft: Draft = {
        title,
        encounterType,
        occurredAt,
        transcript,
        fileName,
        selectedPeopleIds: selectedPeople.map((p) => p.id),
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 500);
    return () => clearTimeout(timer);
  }, [title, encounterType, occurredAt, transcript, fileName, selectedPeople]);

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    setTitle("");
    setEncounterType("meeting");
    setOccurredAt(new Date().toISOString().slice(0, 16));
    setTranscript("");
    setFileName(null);
    setSelectedPeople([]);
    setShowDraftNotice(false);
  }

  // "Add me" — remembers which person you are
  function handleAddMe() {
    const storedId = localStorage.getItem(MY_PERSON_KEY);
    if (storedId) {
      // Match with loose comparison since API may return id as number or string
      const me = people.find((p) => String(p.id) === String(storedId));
      if (me && !selectedPeople.some((s) => s.id === me.id)) {
        setSelectedPeople((prev) => [...prev, me]);
        return;
      }
    }
    // No stored ID or person not found — show the picker
    setPeopleSearch("(pick yourself)");
  }

  function selectPerson(p: Person, setAsMe = false) {
    setSelectedPeople((prev) =>
      prev.some((s) => s.id === p.id) ? prev : [...prev, p]
    );
    setPeopleSearch("");
    if (setAsMe) {
      localStorage.setItem(MY_PERSON_KEY, p.id.toString());
    }
  }

  // Track if we're in "pick yourself" mode
  const pickingMe = peopleSearch === "(pick yourself)";

  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTranscript(text);
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.readAsText(file);
  }

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null || !(e.relatedTarget instanceof Node)) {
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  useEffect(() => {
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragOver, handleDragLeave, handleDrop]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;

    setStep("processing");
    setError(null);

    try {
      const encounterRes = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Meeting",
          encounter_type: encounterType,
          occurred_at: new Date(occurredAt).toISOString(),
          raw_transcript: transcript,
          summary: null,
          source: "plaud",
          participant_ids: selectedPeople.map((p) => p.id),
        }),
      });

      if (!encounterRes.ok) throw new Error("Failed to save encounter");

      const encounter = await encounterRes.json();
      // Clear draft on successful submit
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/review/${encounter.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to save encounter. Please try again.");
      setStep("input");
    }
  }

  async function handleQuickAdd() {
    const name = peopleSearch.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const created: Person = await res.json();
      setPeople((prev) => [...prev, created]);
      setSelectedPeople((prev) => [...prev, created]);
      setPeopleSearch("");
    } catch {
      // ignore
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  const myPersonId = typeof window !== "undefined" ? localStorage.getItem(MY_PERSON_KEY) : null;
  const meAlreadyAdded = myPersonId
    ? selectedPeople.some((s) => s.id === parseInt(myPersonId))
    : false;

  return (
    <div className="space-y-6 relative">
      {/* Full-page drop overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="border-2 border-dashed border-primary rounded-2xl p-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <UploadIcon className="w-12 h-12 text-primary mx-auto" />
            <p className="text-xl font-semibold">Drop your transcript</p>
            <p className="text-muted-foreground">TXT file with speaker names</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import Meeting</h1>
        <div className="flex items-center gap-3">
          {showDraftNotice && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Draft restored</span>
              <button
                onClick={clearDraft}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Start fresh
              </button>
            </div>
          )}
          <Button
            onClick={() => {
              const form = document.getElementById("import-form") as HTMLFormElement;
              form?.requestSubmit();
            }}
            disabled={!transcript.trim() || step === "processing"}
          >
            Import &amp; Extract
          </Button>
        </div>
      </div>

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
            <form id="import-form" onSubmit={handleSubmit} className="space-y-4">
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

              {/* Participants */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Who was in this meeting?</Label>
                  {!meAlreadyAdded && (
                    <button
                      type="button"
                      onClick={handleAddMe}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <UserPlusIcon className="w-3 h-3" />
                      {myPersonId ? "Add me" : "Set as me"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border rounded-md">
                  {selectedPeople.map((p) => (
                    <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                      {p.name}
                      {myPersonId && p.id === parseInt(myPersonId) && (
                        <span className="text-[10px] opacity-60">(me)</span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPeople((prev) =>
                            prev.filter((s) => s.id !== p.id)
                          )
                        }
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={pickingMe ? "" : peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder={selectedPeople.length === 0 ? "Type to search people..." : "Add more..."}
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
                  />
                </div>
                {/* Picking-me mode: show all people to pick yourself */}
                {pickingMe && (
                  <div className="border rounded-md mt-1 max-h-[200px] overflow-y-auto shadow-sm">
                    <p className="px-3 py-1.5 text-xs text-muted-foreground border-b">
                      Which one is you? (only asked once)
                    </p>
                    {people.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPerson(p, true)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        {p.name}
                        {p.organization && (
                          <span className="text-muted-foreground ml-2">{p.organization}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Normal search */}
                {!pickingMe && peopleSearch.length >= 1 && (
                  <div className="border rounded-md mt-1 max-h-[160px] overflow-y-auto shadow-sm">
                    {people
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(peopleSearch.toLowerCase()) &&
                          !selectedPeople.some((s) => s.id === p.id)
                      )
                      .slice(0, 8)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPerson(p)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                        >
                          {p.name}
                          {p.organization && (
                            <span className="text-muted-foreground ml-2">{p.organization}</span>
                          )}
                        </button>
                      ))}
                    {/* Quick-add when no exact match */}
                    {!people.some(
                      (p) => p.name.toLowerCase() === peopleSearch.toLowerCase()
                    ) && (
                      <button
                        type="button"
                        onClick={handleQuickAdd}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-1.5 text-primary"
                      >
                        <UserPlusIcon className="w-3.5 h-3.5" />
                        Add &ldquo;{peopleSearch.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Transcript: drop zone + paste area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="transcript">Transcript</Label>
                  <div className="flex items-center gap-2">
                    {fileName && (
                      <span className="text-xs text-muted-foreground">{fileName}</span>
                    )}
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => {
                          setTranscript("");
                          setFileName(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    <label
                      htmlFor="file"
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Upload file
                    </label>
                    <input
                      id="file"
                      type="file"
                      accept=".txt,.md,.text"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                </div>
                <Textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => { setTranscript(e.target.value); setFileName(null); }}
                  placeholder="Paste your transcript here, or drop a file anywhere on this page..."
                  rows={transcript ? 12 : 6}
                  className={cn(!transcript && "min-h-[120px]")}
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
