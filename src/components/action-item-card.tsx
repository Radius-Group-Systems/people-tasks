"use client";

import { useState, useEffect, useRef } from "react";
import { ActionItem, ActionItemLink, ActionItemAttachment, Person } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LinkIcon,
  PaperclipIcon,
  Trash2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";

interface ActionItemCardProps {
  item: ActionItem;
  onUpdate?: () => void;
  showPerson?: boolean;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-gray-200 text-gray-800",
  low: "bg-gray-100 text-gray-500",
};

const priorityDots: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  normal: "bg-gray-300",
  low: "bg-gray-200",
};

async function patchItem(id: number, data: Record<string, unknown>) {
  await fetch(`/api/action-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

// --- Compact row in the list ---
export function ActionItemCard({
  item,
  onUpdate,
  showPerson = true,
}: ActionItemCardProps) {
  const [open, setOpen] = useState(false);

  const isOverdue =
    item.due_at && new Date(item.due_at) < new Date() && item.status === "open";

  const hasExtras =
    (item.links?.length > 0) || (item.attachments?.length > 0);

  async function handleToggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    await patchItem(item.id, {
      status: item.status === "done" ? "open" : "done",
    });
    onUpdate?.();
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
          "hover:border-primary/30 hover:shadow-sm",
          item.status === "done" && "opacity-50",
          isOverdue && "border-red-300 bg-red-50"
        )}
      >
        <button
          onClick={handleToggleDone}
          className={cn(
            "mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors",
            item.status === "done"
              ? "bg-green-500 border-green-500"
              : "border-gray-300 hover:border-green-400"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                item.status === "done" && "line-through"
              )}
            >
              {item.title}
            </span>
            {item.priority !== "normal" && (
              <Badge
                className={priorityColors[item.priority]}
                variant="secondary"
              >
                {item.priority}
              </Badge>
            )}
            {item.owner_type === "them" && (
              <Badge variant="outline">waiting</Badge>
            )}
            {hasExtras && (
              <span className="flex items-center gap-1 text-muted-foreground">
                {item.links?.length > 0 && <LinkIcon className="w-3.5 h-3.5" />}
                {item.attachments?.length > 0 && <PaperclipIcon className="w-3.5 h-3.5" />}
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {showPerson && item.person_name && <span>{item.person_name}</span>}
            {item.due_trigger === "next_meeting" && (
              <Badge variant="outline" className="text-xs font-normal">
                due next meeting
              </Badge>
            )}
            {item.due_at && item.due_trigger !== "next_meeting" && (
              <span className={cn(isOverdue && "text-red-600 font-medium")}>
                Due {new Date(item.due_at).toLocaleDateString()}
              </span>
            )}
            {item.encounter_title && (
              <span>from: {item.encounter_title}</span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <ActionItemModal
          item={item}
          open={open}
          onClose={() => setOpen(false)}
          onUpdate={() => { onUpdate?.(); }}
          showPerson={showPerson}
        />
      )}
    </>
  );
}

// --- Full detail/edit modal ---
function ActionItemModal({
  item,
  open,
  onClose,
  onUpdate,
  showPerson,
}: {
  item: ActionItem;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  showPerson: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [priority, setPriority] = useState<string>(item.priority);
  const [ownerType, setOwnerType] = useState<string>(item.owner_type);
  const [personId, setPersonId] = useState(item.person_id?.toString() || "");
  const [sourcePersonId, setSourcePersonId] = useState(item.source_person_id?.toString() || "");
  const [status, setStatus] = useState<string>(item.status);
  const [dueTrigger, setDueTrigger] = useState(item.due_trigger || "none");
  const [dueDate, setDueDate] = useState(
    item.due_at ? new Date(item.due_at).toISOString().split("T")[0] : ""
  );
  const [links, setLinks] = useState<ActionItemLink[]>(item.links || []);
  const [attachments, setAttachments] = useState<ActionItemAttachment[]>(item.attachments || []);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/people")
      .then((r) => r.json())
      .then(setPeople)
      .catch(console.error);
  }, []);

  function markDirty() { setDirty(true); }

  const personName = people.find((p) => p.id.toString() === personId)?.name
    || item.person_name
    || "Unassigned";

  async function handleSave() {
    setSaving(true);
    await patchItem(item.id, {
      title: title.trim() || item.title,
      description: description || null,
      priority,
      owner_type: ownerType,
      person_id: personId ? parseInt(personId) : null,
      source_person_id: sourcePersonId ? parseInt(sourcePersonId) : null,
      status,
      due_trigger: dueTrigger === "none" ? null : dueTrigger,
      due_at:
        dueTrigger === "date" && dueDate
          ? new Date(dueDate).toISOString()
          : null,
      links,
      attachments,
    });
    setSaving(false);
    setDirty(false);
    onUpdate();
    onClose();
  }

  async function handleDelete() {
    await fetch(`/api/action-items/${item.id}`, { method: "DELETE" });
    onUpdate();
    onClose();
  }

  function handleAddLink() {
    if (!newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setLinks([...links, { url, label: newLinkLabel.trim() || undefined }]);
    setNewLinkUrl("");
    setNewLinkLabel("");
    setShowLinkInput(false);
    markDirty();
  }

  function handleRemoveLink(index: number) {
    setLinks(links.filter((_, i) => i !== index));
    markDirty();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      setAttachments([...attachments, {
        name: data.name,
        url: data.url,
        type: data.type,
        size: data.size,
      }]);
      markDirty();
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveAttachment(index: number) {
    setAttachments(attachments.filter((_, i) => i !== index));
    markDirty();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto gap-0 p-0" showCloseButton={false}>

        {/* Header: Person top-left, status+priority top-right */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            {showPerson ? (
              <Select value={personId} onValueChange={(v) => { setPersonId(v); markDirty(); }}>
                <SelectTrigger className="h-8 w-auto max-w-[200px] gap-1.5 border-none shadow-none px-1 text-sm font-semibold">
                  <SelectValue placeholder="Assign person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm font-semibold">{personName}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Select value={status} onValueChange={(v) => { setStatus(v); markDirty(); }}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border-none shadow-none px-2 text-sm font-medium">
                <div className={cn("w-2 h-2 rounded-full", priorityDots[priority])} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="snoozed">Snoozed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => { setPriority(v); markDirty(); }}>
              <SelectTrigger className="h-8 w-auto gap-1.5 border-none shadow-none px-2 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors rounded-sm p-1 ml-1">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <DialogTitle className="sr-only">Edit action item</DialogTitle>

        {/* Title */}
        <div className="px-5">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            className="w-full text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            placeholder="Task title"
          />
        </div>

        {/* Description */}
        <div className="px-5 mt-2">
          <Textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            placeholder="Add a description..."
            rows={3}
            className="resize-none border-none shadow-none px-0 focus-visible:ring-0 text-sm"
          />
        </div>

        {/* Metadata: clean rows */}
        <div className="px-5 mt-3 space-y-1.5">
          {/* Row 1: Owner + Deadline */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-14">Owner</span>
              <Select value={ownerType} onValueChange={(v) => { setOwnerType(v); markDirty(); }}>
                <SelectTrigger className="h-7 w-auto border-none shadow-none px-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">I do it</SelectItem>
                  <SelectItem value="them">They do it</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground w-14">Deadline</span>
              <Select value={dueTrigger} onValueChange={(v) => { setDueTrigger(v); markDirty(); }}>
                <SelectTrigger className="h-7 w-auto border-none shadow-none px-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="date">By date</SelectItem>
                  <SelectItem value="next_meeting">Next meeting</SelectItem>
                </SelectContent>
              </Select>
              {dueTrigger === "date" && (
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                  className="h-7 w-[140px] text-sm"
                />
              )}
            </div>
          </div>

          {/* Row 2: Requested by */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-14">From</span>
            <Select value={sourcePersonId} onValueChange={(v) => { setSourcePersonId(v); markDirty(); }}>
              <SelectTrigger className="h-7 w-auto border-none shadow-none px-1 text-sm">
                <SelectValue placeholder="Who asked?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nobody</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {item.encounter_title && (
              <span className="text-xs text-muted-foreground ml-2">
                in {item.encounter_title}
              </span>
            )}
          </div>

          {/* Row 3: Timestamps + Sent status */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>Created {timeAgo(item.created_at)}</span>
            {item.completed_at && (
              <span>Completed {timeAgo(item.completed_at)}</span>
            )}
            {item.snoozed_until && status === "snoozed" && (
              <span>Snooze until {new Date(item.snoozed_until).toLocaleDateString()}</span>
            )}
            {item.sent_at ? (
              <span>Sent {item.sent_via ? `via ${item.sent_via} ` : ""}{timeAgo(item.sent_at)}</span>
            ) : (
              ownerType === "them" && <span className="text-muted-foreground/50">Not sent</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t mt-4" />

        {/* Links section */}
        <div className="px-5 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> Links
            </span>
            <button
              onClick={() => setShowLinkInput(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
          {links.length === 0 && !showLinkInput && (
            <p className="text-sm text-muted-foreground/50 mb-2">No links</p>
          )}
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 py-1 group/link">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline truncate flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                {link.label || link.url}
              </a>
              <button
                onClick={() => handleRemoveLink(i)}
                className="text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover/link:opacity-100 transition-opacity"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {showLinkInput && (
            <div className="flex gap-2 mt-1">
              <Input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="URL"
                className="flex-1 h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
                  if (e.key === "Escape") { setShowLinkInput(false); setNewLinkUrl(""); setNewLinkLabel(""); }
                }}
              />
              <Input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Label"
                className="w-[100px] h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
                  if (e.key === "Escape") { setShowLinkInput(false); setNewLinkUrl(""); setNewLinkLabel(""); }
                }}
              />
              <Button variant="ghost" size="sm" className="h-8" onClick={handleAddLink}>Add</Button>
            </div>
          )}
        </div>

        {/* Attachments section */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <PaperclipIcon className="w-3.5 h-3.5" /> Attachments
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              disabled={uploading}
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          </div>
          {attachments.length === 0 && (
            <p className="text-sm text-muted-foreground/50 mb-2">No attachments</p>
          )}
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 py-1 group/att">
              <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline truncate flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                {att.name}
              </a>
              {att.size && (
                <span className="text-xs text-muted-foreground">{formatFileSize(att.size)}</span>
              )}
              <button
                onClick={() => handleRemoveAttachment(i)}
                className="text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover/att:opacity-100 transition-opacity"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {uploading && (
            <p className="text-sm text-muted-foreground animate-pulse">Uploading...</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-muted-foreground hover:text-red-600 transition-colors flex items-center gap-1.5"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{item.title}&rdquo; will be permanently removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
