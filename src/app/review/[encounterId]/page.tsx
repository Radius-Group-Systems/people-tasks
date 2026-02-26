"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PersonPicker } from "@/components/person-picker";
import { Person, ChecklistItem } from "@/lib/types";
import {
  CheckIcon,
  PencilIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListChecksIcon,
  MessageSquareIcon,
} from "lucide-react";

interface DiscussionPoint {
  viewpoint: string;
  supporting_detail: string | null;
}

interface ExtractedItem {
  title: string;
  description: string | null;
  owner_type: "me" | "them";
  person_name: string | null;
  person_id: string; // person id as string for PersonPicker, or ""
  priority: "low" | "normal" | "high" | "urgent";
  due_hint: string | null;
  checklist: ChecklistItem[];
  discussion_points?: DiscussionPoint[];
  // UI state
  accepted: boolean;
  editing: boolean;
  showDiscussion: boolean;
}

interface ExtractionData {
  encounter_id: number;
  summary: string;
  participants: string[];
  action_items: ExtractedItem[];
  user_name: string | null;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-gray-200 text-gray-800",
  low: "bg-gray-100 text-gray-500",
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = params.encounterId as string;

  const [data, setData] = useState<ExtractionData | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [extracting, setExtracting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  const runExtraction = useCallback(async () => {
    setExtracting(true);
    setError(null);
    try {
      const userPersonId = localStorage.getItem("my-person-id");
      const res = await fetch(`/api/encounters/${encounterId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_person_id: userPersonId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraction failed");
      }
      const result: ExtractionData = await res.json();
      setData(result);

      // Load people to resolve names → IDs
      let peopleList: Person[] = [];
      try {
        const pRes = await fetch("/api/people");
        if (pRes.ok) {
          peopleList = await pRes.json();
          setPeople(peopleList);
        }
      } catch { /* non-critical */ }

      const nameToId = new Map(
        peopleList.map((p) => [p.name.toLowerCase(), p.id.toString()])
      );

      setItems(
        result.action_items.map((item) => ({
          ...item,
          person_id: item.person_name
            ? nameToId.get(item.person_name.toLowerCase()) || ""
            : "",
          accepted: true,
          editing: false,
          showDiscussion: false,
        }))
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [encounterId]);

  useEffect(() => {
    runExtraction();
  }, [runExtraction]);

  function toggleAccepted(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, accepted: !item.accepted } : item
      )
    );
  }

  function toggleEditing(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, editing: !item.editing } : item
      )
    );
  }

  function toggleDiscussion(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, showDiscussion: !item.showDiscussion } : item
      )
    );
  }

  function updateItem(index: number, updates: Partial<ExtractedItem>) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      )
    );
  }

  function updateChecklistItem(itemIndex: number, checkIndex: number, text: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const checklist = item.checklist.map((c, j) =>
          j === checkIndex ? { ...c, text } : c
        );
        return { ...item, checklist };
      })
    );
  }

  function removeChecklistItem(itemIndex: number, checkIndex: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const checklist = item.checklist.filter((_, j) => j !== checkIndex);
        return { ...item, checklist };
      })
    );
  }

  function addChecklistItem(itemIndex: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        return {
          ...item,
          checklist: [
            ...item.checklist,
            { id: crypto.randomUUID(), text: "", done: false },
          ],
        };
      })
    );
  }

  async function handleConfirm() {
    const acceptedItems = items.filter((i) => i.accepted);
    if (acceptedItems.length === 0) {
      router.push("/");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/encounters/${encounterId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: acceptedItems.map(({ title, description, owner_type, person_name, person_id, priority, due_hint, checklist }) => ({
            title,
            description,
            owner_type,
            person_name,
            person_id: person_id ? parseInt(person_id) : null,
            priority,
            due_hint,
            checklist: checklist.filter((c) => c.text.trim()),
          })),
          participants: data?.participants || [],
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const result = await res.json();
      router.push(`/?from_review=${result.items_created}`);
    } catch (err) {
      console.error(err);
      setError("Failed to save action items");
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount = items.filter((i) => i.accepted).length;
  const totalSubtasks = items.filter((i) => i.accepted).reduce((sum, item) => sum + item.checklist.length, 0);

  if (extracting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <SparklesIcon className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-lg font-medium">Analyzing transcript...</p>
        <p className="text-sm text-muted-foreground">Claude is building a structured summary of your meeting</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Review Failed</h1>
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runExtraction}>Retry</Button>
          <Button variant="ghost" onClick={() => router.push("/import")}>
            Back to Import
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Meeting Topics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} topics found — {acceptedCount} selected as tasks with {totalSubtasks} subtasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving..." : `Create ${acceptedCount} Tasks`}
          </Button>
        </div>
      </div>

      {/* AI Summary */}
      {data?.summary && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <p className="text-sm font-medium">Meeting Summary</p>
          <p className="text-sm text-muted-foreground">{data.summary}</p>
          {data.participants.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Participants:</span>
              {data.participants.map((name) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Topics as tasks */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "border rounded-lg overflow-hidden transition-all",
              !item.accepted && "opacity-40"
            )}
          >
            {/* Topic header */}
            <div className={cn(
              "px-4 py-3 flex items-start gap-3",
              item.accepted ? "bg-muted/20" : "bg-muted/5"
            )}>
              <button
                onClick={() => toggleAccepted(index)}
                className={cn(
                  "mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 transition-colors flex items-center justify-center",
                  item.accepted
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-gray-300 hover:border-green-400"
                )}
              >
                {item.accepted && (
                  <CheckIcon className="w-3 h-3" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 font-medium">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{item.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      item.owner_type === "me"
                        ? "border-blue-300 text-blue-700 bg-blue-50"
                        : "border-amber-300 text-amber-700 bg-amber-50"
                    )}
                  >
                    {item.owner_type === "me"
                      ? item.person_name
                        ? `My task → for ${item.person_name}`
                        : "My task"
                      : item.person_name
                        ? `${item.person_name} does this`
                        : "They do it"}
                  </Badge>
                  {item.priority !== "normal" && (
                    <Badge className={priorityColors[item.priority]} variant="secondary">
                      {item.priority}
                    </Badge>
                  )}
                </div>
                {/* Description (conclusion) */}
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggleEditing(index)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Edit controls */}
            {item.editing && (
              <div className="px-4 py-3 border-t bg-muted/10 space-y-3">
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  className="font-medium"
                  placeholder="Task title"
                />
                <Textarea
                  value={item.description || ""}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value || null })
                  }
                  placeholder="Description..."
                  rows={3}
                />
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={item.owner_type}
                    onValueChange={(v) =>
                      updateItem(index, { owner_type: v as "me" | "them" })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">My task</SelectItem>
                      <SelectItem value="them">Their task</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.priority}
                    onValueChange={(v) =>
                      updateItem(index, {
                        priority: v as ExtractedItem["priority"],
                      })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <PersonPicker
                    people={people}
                    value={item.person_id}
                    onSelect={(id) => {
                      const person = people.find((p) => p.id.toString() === id);
                      updateItem(index, {
                        person_id: id,
                        person_name: person?.name || null,
                      });
                    }}
                    onPersonCreated={(newPerson) => {
                      setPeople((prev) =>
                        [...prev, newPerson].sort((a, b) => a.name.localeCompare(b.name))
                      );
                      updateItem(index, {
                        person_id: newPerson.id.toString(),
                        person_name: newPerson.name,
                      });
                    }}
                    placeholder="Person..."
                    className="w-[160px]"
                  />
                  <Input
                    value={item.due_hint || ""}
                    onChange={(e) =>
                      updateItem(index, { due_hint: e.target.value || null })
                    }
                    placeholder="Deadline hint"
                    className="w-[160px]"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleEditing(index)}
                >
                  Done editing
                </Button>
              </div>
            )}

            {/* Checklist (next steps as subtasks) */}
            {item.checklist.length > 0 && (
              <div className="px-4 py-2.5 border-t">
                <div className="flex items-center gap-1.5 mb-2">
                  <ListChecksIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subtasks ({item.checklist.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {item.checklist.map((check, j) => (
                    <div key={check.id} className="flex items-start gap-2 group/check text-sm">
                      <span className="text-muted-foreground/50 mt-0.5 flex-shrink-0">-</span>
                      {item.editing ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            value={check.text}
                            onChange={(e) => updateChecklistItem(index, j, e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-sm"
                            placeholder="Subtask..."
                          />
                          <button
                            onClick={() => removeChecklistItem(index, j)}
                            className="text-muted-foreground/30 hover:text-red-500 text-xs px-1"
                          >
                            remove
                          </button>
                        </div>
                      ) : (
                        <span>{check.text}</span>
                      )}
                    </div>
                  ))}
                  {item.editing && (
                    <button
                      onClick={() => addChecklistItem(index)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1 ml-4"
                    >
                      + Add subtask
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Discussion context (collapsible) */}
            {item.discussion_points && item.discussion_points.length > 0 && (
              <div className="border-t">
                <button
                  onClick={() => toggleDiscussion(index)}
                  className="w-full px-4 py-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
                >
                  {item.showDiscussion ? (
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  )}
                  <MessageSquareIcon className="w-3 h-3" />
                  Discussion context ({item.discussion_points.length} points)
                </button>
                {item.showDiscussion && (
                  <div className="px-4 pb-3 space-y-2">
                    {item.discussion_points.map((dp, j) => (
                      <div key={j} className="text-sm">
                        <p className="text-muted-foreground">{dp.viewpoint}</p>
                        {dp.supporting_detail && (
                          <p className="text-muted-foreground/70 text-xs mt-0.5 pl-3 border-l-2 border-muted">
                            {dp.supporting_detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No topics were found in this transcript.</p>
          <p className="text-sm mt-1">You can still create tasks manually.</p>
        </div>
      )}

      {/* Bottom confirm bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={() => {
              const allAccepted = items.every((i) => i.accepted);
              setItems((prev) =>
                prev.map((item) => ({ ...item, accepted: !allAccepted }))
              );
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {items.every((i) => i.accepted) ? "Deselect all" : "Select all"}
          </button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving..." : `Create ${acceptedCount} Tasks`}
          </Button>
        </div>
      )}
    </div>
  );
}
