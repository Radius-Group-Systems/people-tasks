"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Encounter, ActionItem, MeetingSummary, EncounterFolder } from "@/lib/types";
import { ActionItemCard } from "@/components/action-item-card";
import {
  ArrowLeftIcon,
  CalendarIcon,
  UsersIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  LightbulbIcon,
  FolderIcon,
  PencilIcon,
  CheckIcon,
  StickyNoteIcon,
} from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EncounterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [folders, setFolders] = useState<EncounterFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Notes
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [encRes, itemsRes, folderRes] = await Promise.all([
        fetch(`/api/encounters/${id}`),
        fetch(`/api/action-items?encounter_id=${id}&status=all`),
        fetch("/api/encounter-folders"),
      ]);
      if (!encRes.ok) throw new Error("Encounter not found");
      const enc = await encRes.json();
      const items = await itemsRes.json();
      const fldrs = await folderRes.json();
      setEncounter(enc);
      setActionItems(items);
      setFolders(fldrs);
      setNotes(enc.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function patchEncounter(updates: Record<string, unknown>) {
    const res = await fetch(`/api/encounters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setEncounter((prev) => prev ? { ...prev, ...updated } : prev);
    }
  }

  async function handleTitleSave() {
    if (!titleDraft.trim() || titleDraft === encounter?.title) {
      setEditingTitle(false);
      return;
    }
    await patchEncounter({ title: titleDraft.trim() });
    setEditingTitle(false);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    setNotesDirty(true);
    // Debounced auto-save
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true);
      await patchEncounter({ notes: value || null });
      setNotesDirty(false);
      setSavingNotes(false);
    }, 1000);
  }

  async function handleFolderChange(folderId: string) {
    await patchEncounter({ folder_id: folderId === "none" ? null : parseInt(folderId) });
  }

  async function handleGenerateSummary() {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/encounters/${id}/summarize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Summarization failed");
      const summary: MeetingSummary = await res.json();
      setEncounter((prev) => prev ? { ...prev, detailed_summary: summary } : prev);
    } catch (err) {
      console.error(err);
      setError("Failed to generate summary");
    } finally {
      setSummarizing(false);
    }
  }

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">{error || "Encounter not found"}</p>
        <Button variant="ghost" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const summary = encounter.detailed_summary;
  const doneCount = actionItems.filter((i) => i.status === "done").length;
  const currentFolder = folders.find((f) => f.id === encounter.folder_id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-3"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back
        </button>

        {/* Editable title */}
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSave();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              onBlur={handleTitleSave}
              className="text-2xl font-bold bg-transparent border-b-2 border-primary outline-none flex-1"
            />
            <button onClick={handleTitleSave} className="text-primary p-1">
              <CheckIcon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <h1
            className="text-2xl font-bold group/title cursor-pointer flex items-center gap-2"
            onClick={() => {
              setTitleDraft(encounter.title);
              setEditingTitle(true);
            }}
          >
            {encounter.title}
            <PencilIcon className="w-4 h-4 text-muted-foreground/30 group-hover/title:text-muted-foreground transition-colors" />
          </h1>
        )}

        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            {formatDate(encounter.occurred_at)}
          </span>
          <Badge variant="outline">{encounter.encounter_type}</Badge>
          {encounter.source !== "manual" && (
            <Badge variant="secondary">{encounter.source}</Badge>
          )}
          {/* Folder selector */}
          <Select
            value={encounter.folder_id?.toString() || "none"}
            onValueChange={handleFolderChange}
          >
            <SelectTrigger className="h-7 w-auto border-none shadow-none px-1 text-sm gap-1">
              {currentFolder ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: currentFolder.color }}
                  />
                  {currentFolder.name}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <FolderIcon className="w-3.5 h-3.5" />
                  No folder
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No folder</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id.toString()}>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                    {f.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Participants */}
        {encounter.participants && encounter.participants.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            <UsersIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex flex-wrap gap-1.5">
              {encounter.participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/people/${p.id}`)}
                  className="text-sm px-2.5 py-0.5 bg-muted rounded-full hover:bg-muted/80 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes section */}
      <div className="border rounded-lg">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <StickyNoteIcon className="w-3.5 h-3.5 text-muted-foreground" />
            Notes
          </span>
          {savingNotes && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
          )}
          {!savingNotes && notesDirty && (
            <span className="text-xs text-muted-foreground">Unsaved</span>
          )}
          {!savingNotes && !notesDirty && notes && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this encounter..."
          rows={4}
          className="border-none shadow-none focus-visible:ring-0 resize-none text-sm"
        />
      </div>

      {/* Quick summary if no detailed one yet */}
      {encounter.summary && !summary && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm">{encounter.summary}</p>
        </div>
      )}

      {/* Detailed structured summary */}
      {summary ? (
        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">{summary.overall_summary}</p>
          </div>

          {summary.topics.map((topic, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {topic.topic}
                </h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2Icon className="w-3.5 h-3.5 text-green-600" />
                    Conclusion
                  </h4>
                  <p className="text-sm">{topic.conclusion}</p>
                </div>

                {topic.next_steps.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <LightbulbIcon className="w-3.5 h-3.5 text-amber-500" />
                      Next Steps
                    </h4>
                    <ul className="space-y-1">
                      {topic.next_steps.map((step, j) => (
                        <li key={j} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">-</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {topic.discussion_points.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <MessageSquareIcon className="w-3.5 h-3.5 text-blue-500" />
                      Discussion Points
                    </h4>
                    <div className="space-y-2">
                      {topic.discussion_points.map((dp, j) => (
                        <div key={j} className="text-sm">
                          <p>{dp.viewpoint}</p>
                          {dp.supporting_detail && (
                            <p className="text-muted-foreground text-xs mt-0.5 pl-3 border-l-2 border-muted">
                              {dp.supporting_detail}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : encounter.raw_transcript ? (
        <div className="flex justify-center py-2">
          <Button
            onClick={handleGenerateSummary}
            disabled={summarizing}
            variant="outline"
            className="gap-2"
          >
            {summarizing ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Analyzing transcript...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Generate Detailed Summary
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* Action Items from this encounter */}
      {actionItems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            Action Items
            <span className="text-sm font-normal text-muted-foreground">
              {doneCount}/{actionItems.length} done
            </span>
          </h2>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onUpdate={fetchData}
              />
            ))}
          </div>
        </div>
      )}

      {/* Transcript (expandable) */}
      {encounter.raw_transcript && (
        <div className="border rounded-lg">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileTextIcon className="w-4 h-4 text-muted-foreground" />
              Transcript
            </span>
            {showTranscript ? (
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showTranscript && (
            <div className="px-4 pb-4 border-t">
              <pre className="text-sm whitespace-pre-wrap text-muted-foreground mt-3 max-h-[500px] overflow-y-auto leading-relaxed">
                {encounter.raw_transcript}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
