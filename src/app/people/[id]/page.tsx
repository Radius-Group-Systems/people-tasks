"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { QuickCapture } from "@/components/quick-capture";
import { ActionItemCard } from "@/components/action-item-card";
import { Person, ActionItem, Encounter, Project } from "@/lib/types";
import { PersonAvatar } from "@/components/person-avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2Icon, CameraIcon, PencilIcon, MailIcon, PhoneIcon, BuildingIcon, MessageSquareIcon, StickyNoteIcon, SparklesIcon, FolderKanbanIcon } from "lucide-react";

const STATUSES = ["open", "in_progress", "snoozed", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  snoozed: "Snoozed",
  done: "Done",
};

export default function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [myItemsByStatus, setMyItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [theirItemsByStatus, setTheirItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [personProjects, setPersonProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", slack_handle: "", organization: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{
    total_assigned: number; completed: number; open: number; overdue: number;
    avg_days_to_complete: number | null; completion_rate: number;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const myPersonId = localStorage.getItem("my-person-id");
      const viewingSelf = String(id) === String(myPersonId);
      setIsMe(viewingSelf);

      // When viewing yourself, show ALL your tasks (not filtered by person_id)
      // because your tasks have person_id pointing to the OTHER person, not yourself.
      // When viewing someone else, use involves_person_id to catch tasks where they're
      // either the person_id OR the source_person_id.
      const taskFilter = viewingSelf ? "" : `involves_person_id=${id}&`;

      const fetches = [
        fetch(`/api/people/${id}`),
        fetch(`/api/encounters?person_id=${id}`),
        fetch(`/api/projects?person_id=${id}`),
        fetch(`/api/people/${id}/stats`),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?${taskFilter}owner_type=me&status=${s}`)
        ),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?${taskFilter}owner_type=them&status=${s}`)
        ),
      ];

      const results = await Promise.all(fetches);
      const jsons = await Promise.all(results.map((r) => r.json()));

      setPerson(jsons[0]);
      setEncounters(jsons[1]);
      setPersonProjects(jsons[2]);
      setStats(jsons[3]);

      const myMap: Record<string, ActionItem[]> = {};
      const theirMap: Record<string, ActionItem[]> = {};
      STATUSES.forEach((s, i) => {
        myMap[s] = jsons[4 + i];
        theirMap[s] = jsons[4 + STATUSES.length + i];
      });
      setMyItemsByStatus(myMap);
      setTheirItemsByStatus(theirMap);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    try {
      const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/people");
    } catch (err) {
      console.error("Failed to delete person:", err);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/people/${id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { photo_url } = await res.json();
      setPerson((prev) => prev ? { ...prev, photo_url } : prev);
    } catch (err) {
      console.error("Failed to upload photo:", err);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function startEditing() {
    if (!person) return;
    setEditForm({
      name: person.name || "",
      email: person.email || "",
      phone: person.phone || "",
      slack_handle: person.slack_handle || "",
      organization: person.organization || "",
      notes: person.notes || "",
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setPerson(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save person:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!person) {
    return <div className="text-muted-foreground">Person not found.</div>;
  }

  const myOpenCount = (myItemsByStatus.open || []).length;
  const theirOpenCount = (theirItemsByStatus.open || []).length;

  function renderItemList(items: ActionItem[], emptyMessage: string) {
    if (!items || items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ActionItemCard
            key={item.id}
            item={item}
            onUpdate={fetchData}
            showPerson={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Photo with upload overlay */}
          <div className="relative group/photo flex-shrink-0">
            <PersonAvatar
              name={person.name}
              photoUrl={person.photo_url}
              size="lg"
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-full bg-black/0 group-hover/photo:bg-black/40 transition-colors flex items-center justify-center cursor-pointer"
            >
              <CameraIcon className="w-5 h-5 text-white opacity-0 group-hover/photo:opacity-100 transition-opacity" />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          {editing ? (
            <div className="flex-1 space-y-3 min-w-0">
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Name"
                className="text-xl font-bold h-10"
                autoFocus
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <MailIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="Email"
                    type="email"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Phone"
                    type="tel"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <BuildingIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editForm.organization}
                    onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                    placeholder="Organization"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquareIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editForm.slack_handle}
                    onChange={(e) => setEditForm({ ...editForm, slack_handle: e.target.value })}
                    placeholder="Slack handle"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <StickyNoteIcon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Notes..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving || !editForm.name.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{person.name}</h1>
                <button
                  onClick={startEditing}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                {person.organization && (
                  <span className="flex items-center gap-1">
                    <BuildingIcon className="w-3.5 h-3.5" />
                    {person.organization}
                  </span>
                )}
                {person.email && (
                  <a href={`mailto:${person.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <MailIcon className="w-3.5 h-3.5" />
                    {person.email}
                  </a>
                )}
                {person.phone && (
                  <a href={`tel:${person.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <PhoneIcon className="w-3.5 h-3.5" />
                    {person.phone}
                  </a>
                )}
                {person.slack_handle && (
                  <span className="flex items-center gap-1">
                    <MessageSquareIcon className="w-3.5 h-3.5" />
                    {person.slack_handle}
                  </span>
                )}
              </div>
              {person.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">{person.notes}</p>
              )}
              {!person.email && !person.phone && !person.organization && !person.slack_handle && !person.notes && (
                <button
                  onClick={startEditing}
                  className="text-sm text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors"
                >
                  Add contact details...
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary">
            {myOpenCount} {isMe ? "tasks" : "tasks for me"}
          </Badge>
          <Badge variant="outline">
            {theirOpenCount} {isMe ? "waiting on others" : "waiting on them"}
          </Badge>
          {!isMe && (
            <Link href={`/prep/${id}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5" />
                Prep
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2Icon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {stats && stats.total_assigned > 0 && !isMe && (
        <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold">{stats.completion_rate}%</div>
            <div className="text-[10px] text-muted-foreground">Complete</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.completed}</div>
            <div className="text-[10px] text-muted-foreground">Done</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{stats.open}</div>
            <div className="text-[10px] text-muted-foreground">Open</div>
          </div>
          {stats.overdue > 0 && (
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
              <div className="text-[10px] text-muted-foreground">Overdue</div>
            </div>
          )}
          {stats.avg_days_to_complete !== null && (
            <div className="text-center">
              <div className="text-lg font-bold">{stats.avg_days_to_complete}d</div>
              <div className="text-[10px] text-muted-foreground">Avg time</div>
            </div>
          )}
        </div>
      )}

      <QuickCapture onCreated={fetchData} defaultPersonId={person.id} />

      <Tabs defaultValue="action-items">
        <TabsList>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
          <TabsTrigger value="projects">Projects ({personProjects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="action-items" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isMe ? "My Tasks" : "I need to do"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="open">
                <TabsList>
                  {STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {STATUS_LABELS[s]} ({(myItemsByStatus[s] || []).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {STATUSES.map((s) => (
                  <TabsContent key={s} value={s} className="mt-3">
                    {renderItemList(
                      myItemsByStatus[s] || [],
                      s === "open"
                        ? isMe ? "Nothing on your plate. Nice." : `Nothing you owe ${person.name}.`
                        : `No ${STATUS_LABELS[s].toLowerCase()} tasks.`
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isMe ? "Waiting On" : `${person.name} needs to do`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="open">
                <TabsList>
                  {STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {STATUS_LABELS[s]} ({(theirItemsByStatus[s] || []).length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {STATUSES.map((s) => (
                  <TabsContent key={s} value={s} className="mt-3">
                    {renderItemList(
                      theirItemsByStatus[s] || [],
                      s === "open"
                        ? isMe ? "No one owes you anything right now." : `${person.name} doesn't owe you anything.`
                        : `No ${STATUS_LABELS[s].toLowerCase()} tasks.`
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encounters" className="mt-4">
          {encounters.length === 0 ? (
            <p className="text-muted-foreground">
              No encounters recorded with {person.name} yet.
            </p>
          ) : (
            <div className="space-y-4">
              {encounters.map((enc) => (
                <Link key={enc.id} href={`/encounters/${enc.id}`}>
                  <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{enc.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(enc.occurred_at).toLocaleDateString()}{" "}
                            &middot; {enc.encounter_type}
                          </p>
                        </div>
                        <Badge variant="outline">{enc.source}</Badge>
                      </div>
                      {enc.summary && (
                        <>
                          <Separator className="my-3" />
                          <p className="text-sm">{enc.summary}</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          {personProjects.length === 0 ? (
            <p className="text-muted-foreground">Not involved in any projects.</p>
          ) : (
            <div className="space-y-3">
              {personProjects.map((proj) => (
                <Link key={proj.id} href={`/projects/${proj.id}`}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: proj.color }} />
                        <h3 className="font-medium">{proj.name}</h3>
                        <Badge variant="outline" className="text-[10px]">{proj.status}</Badge>
                      </div>
                      {proj.description && <p className="text-sm text-muted-foreground mt-1">{proj.description}</p>}
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        {(proj.task_count ?? 0) > 0 && <span>{proj.done_count}/{proj.task_count} tasks</span>}
                        {proj.next_milestone && <span>Next: {proj.next_milestone}</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {person.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {person.name} from your contacts. Their action items will be
              kept but unlinked from this person. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
