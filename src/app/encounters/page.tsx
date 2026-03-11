"use client";

import { useState, useEffect, useMemo, useRef, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { EncounterFolder } from "@/lib/types";
import {
  CalendarIcon,
  UsersIcon,
  ListChecksIcon,
  Trash2Icon,
  FileTextIcon,
  ArrowUpDownIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  GripVerticalIcon,
  XIcon,
  MailIcon,
  PaperclipIcon,
  FolderKanbanIcon,
} from "lucide-react";

interface EncounterRow {
  id: number;
  title: string;
  encounter_type: string;
  occurred_at: string;
  summary: string | null;
  raw_transcript: string | null;
  source: string;
  folder_id: number | null;
  folder_name: string | null;
  folder_color: string | null;
  created_at: string;
  participant_count: number;
  action_item_count: number;
  participant_names: string | null;
  email_from: { name: string; address: string } | null;
  email_attachments: { name: string; content_type: string; size: number; path: string }[] | null;
  project_id: number | null;
  project_name: string | null;
  project_color: string | null;
}

const typeLabels: Record<string, string> = {
  meeting: "Meeting",
  call: "Call",
  email: "Email",
  chat: "Chat",
};

const typeColors: Record<string, string> = {
  meeting: "bg-blue-100 text-blue-700",
  call: "bg-green-100 text-green-700",
  email: "bg-purple-100 text-purple-700",
  chat: "bg-amber-100 text-amber-700",
};

const FOLDER_COLORS = [
  "#6b7280", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4",
];

type SortKey = "date_desc" | "date_asc" | "title" | "items";

export default function EncountersPage() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [folders, setFolders] = useState<EncounterFolder[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeFolder, setActiveFolder] = useState<number | null>(null); // null = all
  const [sortBy, setSortBy] = useState<SortKey>("date_desc");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EncounterRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<EncounterFolder | null>(null);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<number | "unfiled" | null>(null);

  // Inline folder creation
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#3b82f6");
  const newFolderRef = useRef<HTMLInputElement>(null);

  // Inline folder rename
  const [renamingFolder, setRenamingFolder] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (creatingFolder && newFolderRef.current) newFolderRef.current.focus();
  }, [creatingFolder]);
  useEffect(() => {
    if (renamingFolder && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingFolder]);

  async function fetchData() {
    try {
      const [encRes, folderRes] = await Promise.all([
        fetch("/api/encounters"),
        fetch("/api/encounter-folders"),
      ]);
      setEncounters(await encRes.json());
      setFolders(await folderRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/encounters/${deleteTarget.id}`, { method: "DELETE" });
      setEncounters((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleDeleteFolder() {
    if (!deleteFolderTarget) return;
    await fetch(`/api/encounter-folders?id=${deleteFolderTarget.id}`, { method: "DELETE" });
    setFolders((prev) => prev.filter((f) => f.id !== deleteFolderTarget.id));
    if (activeFolder === deleteFolderTarget.id) setActiveFolder(null);
    setDeleteFolderTarget(null);
    // Unfiled encounters refresh
    setEncounters((prev) =>
      prev.map((e) =>
        e.folder_id === deleteFolderTarget.id
          ? { ...e, folder_id: null, folder_name: null, folder_color: null }
          : e
      )
    );
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) { setCreatingFolder(false); return; }
    const res = await fetch("/api/encounter-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim(), color: newFolderColor }),
    });
    const folder = await res.json();
    setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
    setNewFolderName("");
    setNewFolderColor("#3b82f6");
    setCreatingFolder(false);
  }

  async function handleRenameFolder(id: number) {
    if (!renameDraft.trim()) { setRenamingFolder(null); return; }
    await fetch("/api/encounter-folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: renameDraft.trim() }),
    });
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: renameDraft.trim() } : f))
    );
    setEncounters((prev) =>
      prev.map((e) => (e.folder_id === id ? { ...e, folder_name: renameDraft.trim() } : e))
    );
    setRenamingFolder(null);
  }

  async function moveToFolder(encounterId: number, folderId: number | null) {
    await fetch(`/api/encounters/${encounterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
    setEncounters((prev) =>
      prev.map((e) => {
        if (e.id !== encounterId) return e;
        const folder = folders.find((f) => f.id === folderId);
        return {
          ...e,
          folder_id: folderId,
          folder_name: folder?.name || null,
          folder_color: folder?.color || null,
        };
      })
    );
  }

  async function handleNewMeeting() {
    const title = prompt("Meeting title:");
    if (!title?.trim()) return;
    setCreatingMeeting(true);
    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          encounter_type: "meeting",
          occurred_at: new Date().toISOString(),
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error("Failed to create encounter");
      const encounter = await res.json();
      router.push(`/encounters/${encounter.id}`);
    } catch (err) {
      console.error("Failed to create meeting:", err);
      setCreatingMeeting(false);
    }
  }

  // --- Drag handlers ---
  function onDragStart(e: DragEvent, encId: number) {
    setDraggingId(encId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", encId.toString());
    // Slight delay so the drag image isn't the hover state
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-enc-id="${encId}"]`) as HTMLElement;
      if (el) el.style.opacity = "0.4";
    });
  }

  function onDragEnd() {
    if (draggingId) {
      const el = document.querySelector(`[data-enc-id="${draggingId}"]`) as HTMLElement;
      if (el) el.style.opacity = "1";
    }
    setDraggingId(null);
    setDragOverFolder(null);
  }

  function onFolderDragOver(e: DragEvent, folderId: number | "unfiled") {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderId);
  }

  function onFolderDragLeave() {
    setDragOverFolder(null);
  }

  function onFolderDrop(e: DragEvent, folderId: number | null) {
    e.preventDefault();
    const encId = parseInt(e.dataTransfer.getData("text/plain"));
    if (!isNaN(encId)) {
      moveToFolder(encId, folderId);
    }
    setDragOverFolder(null);
    setDraggingId(null);
  }

  // --- Filtered list ---
  const filtered = useMemo(() => {
    let result = encounters;

    if (typeFilter !== "all") {
      result = result.filter((e) => e.encounter_type === typeFilter);
    }

    if (activeFolder === -1) {
      result = result.filter((e) => !e.folder_id);
    } else if (activeFolder !== null) {
      result = result.filter((e) => e.folder_id === activeFolder);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.participant_names?.toLowerCase().includes(q) ||
          e.summary?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
        case "date_asc":
          return new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "items":
          return b.action_item_count - a.action_item_count;
        default:
          return 0;
      }
    });

    return result;
  }, [encounters, search, typeFilter, activeFolder, sortBy]);

  const types = useMemo(() => {
    const set = new Set(encounters.map((e) => e.encounter_type));
    return Array.from(set).sort();
  }, [encounters]);

  function folderCount(folderId: number | null) {
    return encounters.filter((e) =>
      folderId === null ? !e.folder_id : e.folder_id === folderId
    ).length;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" onDragOver={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encounters</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {encounters.length} encounter{encounters.length !== 1 ? "s" : ""}
            {draggingId && " — drop on a folder to move"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNewMeeting} disabled={creatingMeeting}>
            <PlusIcon className="w-4 h-4 mr-1.5" />
            {creatingMeeting ? "Creating..." : "New Meeting"}
          </Button>
          <Button onClick={() => router.push("/import")}>
            Import Transcript
          </Button>
        </div>
      </div>

      {/* Folders — visual cards */}
      <div className="flex gap-3 flex-wrap items-end">
        {/* All */}
        <button
          onClick={() => setActiveFolder(null)}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[80px]",
            activeFolder === null
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50"
          )}
        >
          <FolderIcon className="w-8 h-8 text-muted-foreground" />
          <span className="text-xs font-medium">All</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {encounters.length}
          </span>
        </button>

        {/* Unfiled — droppable */}
        <button
          onClick={() => setActiveFolder(-1)}
          onDragOver={(e) => onFolderDragOver(e, "unfiled")}
          onDragLeave={onFolderDragLeave}
          onDrop={(e) => onFolderDrop(e, null)}
          className={cn(
            "flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[80px]",
            activeFolder === -1
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50",
            dragOverFolder === "unfiled" && "border-primary bg-primary/10 scale-105 shadow-md"
          )}
        >
          <FolderIcon className="w-8 h-8 text-gray-400" />
          <span className="text-xs font-medium">Unfiled</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {folderCount(null)}
          </span>
        </button>

        {/* Folder cards */}
        {folders.map((f) => (
          <div
            key={f.id}
            onDragOver={(e) => onFolderDragOver(e, f.id)}
            onDragLeave={onFolderDragLeave}
            onDrop={(e) => onFolderDrop(e, f.id)}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[80px] relative group/fc cursor-pointer",
              activeFolder === f.id
                ? "shadow-sm"
                : "border-transparent hover:bg-muted/50",
              dragOverFolder === f.id && "scale-105 shadow-md"
            )}
            style={{
              borderColor:
                activeFolder === f.id
                  ? f.color
                  : dragOverFolder === f.id
                    ? f.color
                    : undefined,
              backgroundColor:
                dragOverFolder === f.id
                  ? f.color + "15"
                  : activeFolder === f.id
                    ? f.color + "08"
                    : undefined,
            }}
            onClick={() => setActiveFolder(activeFolder === f.id ? null : f.id)}
          >
            {/* Context menu on right-click or hover buttons */}
            <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover/fc:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameDraft(f.name);
                  setRenamingFolder(f.id);
                }}
                className="w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-muted"
              >
                <span className="text-[10px]">✏️</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteFolderTarget(f);
                }}
                className="w-5 h-5 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-red-50"
              >
                <XIcon className="w-3 h-3 text-red-500" />
              </button>
            </div>

            {activeFolder === f.id ? (
              <FolderOpenIcon className="w-8 h-8" style={{ color: f.color }} />
            ) : (
              <FolderIcon className="w-8 h-8" style={{ color: f.color }} />
            )}

            {renamingFolder === f.id ? (
              <input
                ref={renameRef}
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameFolder(f.id);
                  if (e.key === "Escape") setRenamingFolder(null);
                }}
                onBlur={() => handleRenameFolder(f.id)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium w-16 text-center bg-transparent border-b border-primary outline-none"
              />
            ) : (
              <span className="text-xs font-medium max-w-[80px] truncate">{f.name}</span>
            )}
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {folderCount(f.id)}
            </span>
          </div>
        ))}

        {/* New folder button / inline create */}
        {creatingFolder ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-primary/40 min-w-[80px]">
            <div className="flex gap-0.5 mb-1">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewFolderColor(c)}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all",
                    newFolderColor === c && "ring-2 ring-offset-1 ring-primary"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <FolderIcon className="w-6 h-6" style={{ color: newFolderColor }} />
            <input
              ref={newFolderRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
              onBlur={handleCreateFolder}
              placeholder="Name..."
              className="text-xs w-16 text-center bg-transparent border-b border-primary/40 outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        ) : (
          <button
            onClick={() => setCreatingFolder(true)}
            className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30 transition-all min-w-[80px] text-muted-foreground/50 hover:text-muted-foreground"
          >
            <PlusIcon className="w-8 h-8" />
            <span className="text-xs font-medium">New</span>
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Input
          placeholder="Search encounters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {typeLabels[t] || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDownIcon className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">Newest first</SelectItem>
            <SelectItem value="date_asc">Oldest first</SelectItem>
            <SelectItem value="title">Title A-Z</SelectItem>
            <SelectItem value="items">Most tasks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Encounter list — draggable rows */}
      <div className="space-y-2">
        {filtered.map((enc) => (
          <div
            key={enc.id}
            data-enc-id={enc.id}
            draggable
            onDragStart={(e) => onDragStart(e, enc.id)}
            onDragEnd={onDragEnd}
            className={cn(
              "flex items-center gap-3 p-4 border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all group cursor-grab active:cursor-grabbing",
              draggingId === enc.id && "opacity-40"
            )}
          >
            {/* Drag handle */}
            <GripVerticalIcon className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 group-hover:text-muted-foreground/60 transition-colors" />

            {/* Main content */}
            <Link href={`/encounters/${enc.id}`} className="flex-1 min-w-0" draggable={false}>
              <div className="flex items-center gap-2 mb-1">
                {enc.encounter_type === "email" && (
                  <MailIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                )}
                <span className="font-semibold text-foreground truncate">{enc.title}</span>
                <Badge
                  variant="secondary"
                  className={cn("text-xs flex-shrink-0", typeColors[enc.encounter_type])}
                >
                  {typeLabels[enc.encounter_type] || enc.encounter_type}
                </Badge>
                {enc.folder_name && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                    style={{
                      backgroundColor: (enc.folder_color || "#6b7280") + "20",
                      color: enc.folder_color || "#6b7280",
                    }}
                  >
                    <FolderIcon className="w-3 h-3" />
                    {enc.folder_name}
                  </span>
                )}
                {enc.project_name && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                    style={{
                      backgroundColor: (enc.project_color || "#6b7280") + "20",
                      color: enc.project_color || "#6b7280",
                    }}
                  >
                    <FolderKanbanIcon className="w-3 h-3" />
                    {enc.project_name}
                  </span>
                )}
              </div>

              {/* For emails: show from address. For others: show summary */}
              {enc.encounter_type === "email" && enc.email_from ? (
                <p className="text-sm text-foreground/70 line-clamp-1 mb-1.5">
                  From {enc.email_from.name || enc.email_from.address}
                  {enc.email_from.name && (
                    <span className="text-foreground/40"> &lt;{enc.email_from.address}&gt;</span>
                  )}
                </p>
              ) : enc.summary ? (
                <p className="text-sm text-foreground/70 line-clamp-1 mb-1.5">
                  {enc.summary}
                </p>
              ) : null}

              <div className="flex items-center gap-4 text-xs text-foreground/50">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {formatDate(enc.occurred_at)} at {formatTime(enc.occurred_at)}
                </span>
                {enc.participant_count > 0 && (
                  <span className="flex items-center gap-1">
                    <UsersIcon className="w-3 h-3" />
                    {enc.participant_names || `${enc.participant_count} people`}
                  </span>
                )}
                {enc.action_item_count > 0 && (
                  <span className="flex items-center gap-1 text-foreground/70">
                    <ListChecksIcon className="w-3 h-3" />
                    {enc.action_item_count} task{enc.action_item_count !== 1 ? "s" : ""}
                  </span>
                )}
                {enc.email_attachments && enc.email_attachments.length > 0 && (
                  <span className="flex items-center gap-1">
                    <PaperclipIcon className="w-3 h-3" />
                    {enc.email_attachments.length} file{enc.email_attachments.length !== 1 ? "s" : ""}
                  </span>
                )}
                {enc.raw_transcript && enc.encounter_type !== "email" && (
                  <span className="flex items-center gap-1">
                    <FileTextIcon className="w-3 h-3" />
                    Transcript
                  </span>
                )}
              </div>
            </Link>

            {/* Delete */}
            <button
              onClick={() => setDeleteTarget(enc)}
              className="text-muted-foreground/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2 flex-shrink-0"
            >
              <Trash2Icon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {encounters.length === 0 ? (
            <div className="space-y-2">
              <p>No encounters yet.</p>
              <p className="text-sm">
                <Link href="/import" className="text-primary hover:underline">
                  Import a transcript
                </Link>{" "}
                to get started.
              </p>
            </div>
          ) : (
            <p>No encounters match your filters.</p>
          )}
        </div>
      )}

      {/* Delete encounter */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this encounter?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">&ldquo;{deleteTarget?.title}&rdquo;</span> will be
              permanently deleted along with{" "}
              {deleteTarget?.action_item_count
                ? `${deleteTarget.action_item_count} linked task${deleteTarget.action_item_count !== 1 ? "s" : ""}, `
                : ""}
              its transcript, and all embeddings. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Deleting..." : "Delete Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder */}
      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder &ldquo;{deleteFolderTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Encounters in this folder will become unfiled. They won&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
