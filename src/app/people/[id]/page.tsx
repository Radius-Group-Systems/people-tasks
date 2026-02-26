"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
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
import { Person, ActionItem, Encounter } from "@/lib/types";
import { PersonAvatar } from "@/components/person-avatar";
import { Trash2Icon, CameraIcon } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const fetches = [
        fetch(`/api/people/${id}`),
        fetch(`/api/encounters?person_id=${id}`),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?person_id=${id}&owner_type=me&status=${s}`)
        ),
        ...STATUSES.map((s) =>
          fetch(`/api/action-items?person_id=${id}&owner_type=them&status=${s}`)
        ),
      ];

      const results = await Promise.all(fetches);
      const jsons = await Promise.all(results.map((r) => r.json()));

      setPerson(jsons[0]);
      setEncounters(jsons[1]);

      const myMap: Record<string, ActionItem[]> = {};
      const theirMap: Record<string, ActionItem[]> = {};
      STATUSES.forEach((s, i) => {
        myMap[s] = jsons[2 + i];
        theirMap[s] = jsons[2 + STATUSES.length + i];
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Photo with upload overlay */}
          <div className="relative group/photo">
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
          <div>
            <h1 className="text-2xl font-bold">{person.name}</h1>
            <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
              {person.organization && <span>{person.organization}</span>}
              {person.email && <span>{person.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {myOpenCount} tasks for me
          </Badge>
          <Badge variant="outline">
            {theirOpenCount} waiting on them
          </Badge>
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

      <QuickCapture onCreated={fetchData} defaultPersonId={person.id} />

      <Tabs defaultValue="action-items">
        <TabsList>
          <TabsTrigger value="action-items">Action Items</TabsTrigger>
          <TabsTrigger value="encounters">Encounters</TabsTrigger>
        </TabsList>

        <TabsContent value="action-items" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">I need to do</CardTitle>
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
                        ? `Nothing you owe ${person.name}.`
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
                {person.name} needs to do
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
                        ? `${person.name} doesn't owe you anything.`
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
                <Card key={enc.id}>
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
