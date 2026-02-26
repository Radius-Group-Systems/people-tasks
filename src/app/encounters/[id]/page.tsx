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
  PlusCircleIcon,
  ListChecksIcon,
  MailIcon,
  PaperclipIcon,
  DownloadIcon,
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "image/gif": "🖼️",
  "text/plain": "📝",
  "text/csv": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📄",
  "application/zip": "📦",
};

function getFileIcon(contentType: string): string {
  return FILE_ICONS[contentType] || "📎";
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

  // Topic-to-task conversion
  const [createdTopics, setCreatedTopics] = useState<Set<number>>(new Set());
  const [creatingTopic, setCreatingTopic] = useState<number | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);

  // Email quick-task creation
  const [creatingEmailTask, setCreatingEmailTask] = useState(false);
  const [emailTaskCreated, setEmailTaskCreated] = useState(false);

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

  async function createTaskFromTopic(topicIndex: number) {
    const summary = encounter?.detailed_summary;
    if (!summary) return;
    const topic = summary.topics[topicIndex];

    setCreatingTopic(topicIndex);
    try {
      const checklist = topic.next_steps.map((step) => ({
        id: crypto.randomUUID(),
        text: step,
        done: false,
      }));

      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.topic,
          description: topic.conclusion,
          owner_type: "me",
          encounter_id: parseInt(id),
          priority: "normal",
          checklist,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");

      setCreatedTopics((prev) => new Set([...prev, topicIndex]));
      // Refresh action items
      const itemsRes = await fetch(`/api/action-items?encounter_id=${id}&status=all`);
      if (itemsRes.ok) setActionItems(await itemsRes.json());
    } catch (err) {
      console.error(err);
      setError("Failed to create task from topic");
    } finally {
      setCreatingTopic(null);
    }
  }

  async function createAllTasksFromTopics() {
    const summary = encounter?.detailed_summary;
    if (!summary) return;

    setCreatingAll(true);
    try {
      const newCreated = new Set(createdTopics);
      for (let i = 0; i < summary.topics.length; i++) {
        if (newCreated.has(i)) continue; // skip already created
        const topic = summary.topics[i];
        const checklist = topic.next_steps.map((step) => ({
          id: crypto.randomUUID(),
          text: step,
          done: false,
        }));

        const res = await fetch("/api/action-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: topic.topic,
            description: topic.conclusion,
            owner_type: "me",
            encounter_id: parseInt(id),
            priority: "normal",
            checklist,
          }),
        });
        if (res.ok) newCreated.add(i);
      }
      setCreatedTopics(newCreated);
      // Refresh action items
      const itemsRes = await fetch(`/api/action-items?encounter_id=${id}&status=all`);
      if (itemsRes.ok) setActionItems(await itemsRes.json());
    } catch (err) {
      console.error(err);
      setError("Failed to create tasks");
    } finally {
      setCreatingAll(false);
    }
  }

  async function createTaskFromEmail(ownerType: "me" | "them") {
    if (!encounter) return;
    setCreatingEmailTask(true);
    try {
      // Find the sender in participants to link as source_person
      const senderEmail = encounter.email_from?.address?.toLowerCase();
      const senderParticipant = senderEmail
        ? encounter.participants?.find((p) => p.email?.toLowerCase() === senderEmail)
        : null;

      // Get my person id
      const myId = typeof window !== "undefined" ? localStorage.getItem("my-person-id") : null;

      // Carry over email attachments to the task
      const attachments = (encounter.email_attachments || []).map((att) => ({
        name: att.name,
        url: att.path,
        type: att.content_type,
        size: att.size,
      }));

      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: encounter.title,
          description: encounter.raw_transcript
            ? encounter.raw_transcript.slice(0, 500) + (encounter.raw_transcript.length > 500 ? "..." : "")
            : `Email from ${encounter.email_from?.name || encounter.email_from?.address || "unknown"}`,
          owner_type: ownerType,
          encounter_id: parseInt(id),
          person_id: ownerType === "them"
            ? senderParticipant?.id || null
            : senderParticipant?.id || null,
          source_person_id: ownerType === "me"
            ? senderParticipant?.id || null
            : myId ? parseInt(myId) : null,
          priority: "normal",
          attachments,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");

      setEmailTaskCreated(true);
      // Refresh action items
      const itemsRes = await fetch(`/api/action-items?encounter_id=${id}&status=all`);
      if (itemsRes.ok) setActionItems(await itemsRes.json());
    } catch (err) {
      console.error(err);
      setError("Failed to create task from email");
    } finally {
      setCreatingEmailTask(false);
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
  const isEmail = encounter.encounter_type === "email";
  const emailAttachments = encounter.email_attachments || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back
      </button>

      {/* ═══════════════════════════════════════════ */}
      {/* EMAIL VIEW */}
      {/* ═══════════════════════════════════════════ */}
      {isEmail ? (
        <>
          {/* Email card */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            {/* Email header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Subject / editable title */}
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
                        className="text-lg font-semibold bg-transparent border-b-2 border-primary outline-none flex-1"
                      />
                      <button onClick={handleTitleSave} className="text-primary p-1">
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h1
                      className="text-lg font-semibold group/title cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        setTitleDraft(encounter.title);
                        setEditingTitle(true);
                      }}
                    >
                      <MailIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      <span className="truncate">{encounter.title}</span>
                      <PencilIcon className="w-3.5 h-3.5 text-muted-foreground/0 group-hover/title:text-muted-foreground/50 transition-colors flex-shrink-0" />
                    </h1>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(encounter.occurred_at)}
                  </p>
                </div>

                {/* Folder selector */}
                <Select
                  value={encounter.folder_id?.toString() || "none"}
                  onValueChange={handleFolderChange}
                >
                  <SelectTrigger className="h-7 w-auto border-none shadow-none px-1 text-xs gap-1 flex-shrink-0">
                    {currentFolder ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: currentFolder.color }}
                        />
                        {currentFolder.name}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <FolderIcon className="w-3 h-3" />
                        Folder
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

              {/* From / To / CC */}
              <div className="mt-3 space-y-1 text-sm">
                {encounter.email_from && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right flex-shrink-0">From</span>
                    <span className="font-medium">
                      {encounter.email_from.name && (
                        <span>{encounter.email_from.name} </span>
                      )}
                      <span className="text-muted-foreground font-normal">
                        &lt;{encounter.email_from.address}&gt;
                      </span>
                    </span>
                  </div>
                )}
                {encounter.email_to && encounter.email_to.length > 0 && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right flex-shrink-0">To</span>
                    <span className="text-muted-foreground">
                      {encounter.email_to.map((a, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          {a.name ? `${a.name} <${a.address}>` : a.address}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {encounter.email_cc && encounter.email_cc.length > 0 && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right flex-shrink-0">Cc</span>
                    <span className="text-muted-foreground">
                      {encounter.email_cc.map((a, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          {a.name ? `${a.name} <${a.address}>` : a.address}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {/* Linked people */}
              {encounter.participants && encounter.participants.length > 0 && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-200/50">
                  <UsersIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1.5">
                    {encounter.participants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/people/${p.id}`)}
                        className="text-xs px-2 py-0.5 bg-white/70 border border-purple-200/50 rounded-full hover:bg-white transition-colors"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email body */}
            <div className="px-5 py-4">
              {encounter.raw_transcript ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85 max-h-[600px] overflow-y-auto">
                  {encounter.raw_transcript}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No email body available</p>
              )}
            </div>

            {/* Attachments */}
            {emailAttachments.length > 0 && (
              <div className="border-t px-5 py-3 bg-muted/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {emailAttachments.length} attachment{emailAttachments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {emailAttachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group/att text-sm"
                    >
                      <span className="text-base">{getFileIcon(att.content_type)}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[200px] text-xs">{att.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                      <DownloadIcon className="w-3.5 h-3.5 text-muted-foreground/0 group-hover/att:text-muted-foreground transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create task from email */}
          {actionItems.length === 0 && !emailTaskCreated ? (
            <div className="flex items-center gap-3 p-4 border border-dashed rounded-lg bg-muted/20">
              <div className="flex-1">
                <p className="text-sm font-medium">Create a task from this email</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {encounter.email_from?.name || encounter.email_from?.address || "The sender"} is asking you to do something? Or do you need to follow up?
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={creatingEmailTask}
                  onClick={() => createTaskFromEmail("me")}
                >
                  <PlusCircleIcon className="w-3.5 h-3.5" />
                  I need to do this
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={creatingEmailTask}
                  onClick={() => createTaskFromEmail("them")}
                >
                  <PlusCircleIcon className="w-3.5 h-3.5" />
                  They need to do this
                </Button>
              </div>
            </div>
          ) : emailTaskCreated && actionItems.length > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle2Icon className="w-4 h-4" />
              Task created — edit it below
            </div>
          ) : null}

          {/* Notes (below email card) */}
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
              placeholder="Add notes about this email..."
              rows={3}
              className="border-none shadow-none focus-visible:ring-0 resize-none text-sm"
            />
          </div>
        </>
      ) : (
        <>
          {/* ═══════════════════════════════════════════ */}
          {/* NON-EMAIL ENCOUNTER VIEW (meetings, calls, etc.) */}
          {/* ═══════════════════════════════════════════ */}
          <div>
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
        </>
      )}

      {/* Detailed structured summary — shared for both email & non-email */}
      {summary ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-4 bg-muted/50 rounded-lg flex-1">
              <p className="text-sm">{summary.overall_summary}</p>
            </div>
          </div>

          {/* Bulk create all tasks */}
          {summary.topics.length > 0 && createdTopics.size < summary.topics.length && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={creatingAll}
                onClick={createAllTasksFromTopics}
              >
                {creatingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating tasks...
                  </>
                ) : (
                  <>
                    <ListChecksIcon className="w-3.5 h-3.5" />
                    Create tasks from all {summary.topics.length - createdTopics.size} topics
                  </>
                )}
              </Button>
            </div>
          )}

          {summary.topics.map((topic, i) => (
            <div key={i} className={cn(
              "border rounded-lg overflow-hidden",
              createdTopics.has(i) && "border-green-200"
            )}>
              <div className={cn(
                "px-4 py-3 border-b flex items-center justify-between",
                createdTopics.has(i) ? "bg-green-50" : "bg-muted/30"
              )}>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full text-xs flex items-center justify-center flex-shrink-0",
                    createdTopics.has(i)
                      ? "bg-green-100 text-green-700"
                      : "bg-primary/10 text-primary"
                  )}>
                    {createdTopics.has(i) ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  {topic.topic}
                </h3>
                {createdTopics.has(i) ? (
                  <span className="text-xs text-green-600 font-medium">Task created</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    disabled={creatingTopic === i || creatingAll}
                    onClick={() => createTaskFromTopic(i)}
                  >
                    {creatingTopic === i ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PlusCircleIcon className="w-3.5 h-3.5" />
                    )}
                    Create task
                  </Button>
                )}
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
                      Next Steps ({topic.next_steps.length})
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
      ) : encounter.raw_transcript && !isEmail ? (
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

      {/* Transcript (expandable) — only for non-email encounters */}
      {encounter.raw_transcript && !isEmail && (
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
