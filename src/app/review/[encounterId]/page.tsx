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
import { Person } from "@/lib/types";
import { CheckIcon, XIcon, PencilIcon, SparklesIcon } from "lucide-react";

interface ExtractedItem {
  title: string;
  description: string | null;
  owner_type: "me" | "them";
  person_name: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_hint: string | null;
  // UI state
  accepted: boolean;
  editing: boolean;
}

interface ExtractionData {
  encounter_id: number;
  summary: string;
  participants: string[];
  action_items: ExtractedItem[];
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
      setItems(
        result.action_items.map((item) => ({
          ...item,
          accepted: true,
          editing: false,
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
    fetch("/api/people")
      .then((r) => r.json())
      .then(setPeople)
      .catch(console.error);
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

  function updateItem(index: number, updates: Partial<ExtractedItem>) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      )
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
          items: acceptedItems.map(({ title, description, owner_type, person_name, priority, due_hint }) => ({
            title,
            description,
            owner_type,
            person_name,
            priority,
            due_hint,
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

  if (extracting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <SparklesIcon className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-lg font-medium">Analyzing transcript...</p>
        <p className="text-sm text-muted-foreground">Claude is extracting action items from your meeting</p>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Extracted Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} action items found — {acceptedCount} selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving..." : `Confirm ${acceptedCount} Items`}
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

      {/* Action items list */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "border rounded-lg p-4 transition-all",
              !item.accepted && "opacity-40"
            )}
          >
            {item.editing ? (
              // Edit mode
              <div className="space-y-3">
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  className="font-medium"
                  autoFocus
                />
                <Textarea
                  value={item.description || ""}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value || null })
                  }
                  placeholder="Description..."
                  rows={2}
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
                  <Select
                    value={item.person_name || "_none"}
                    onValueChange={(v) =>
                      updateItem(index, {
                        person_name: v === "_none" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Person" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No person</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            ) : (
              // Display mode
              <div className="flex items-start gap-3">
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.priority !== "normal" && (
                      <Badge className={priorityColors[item.priority]} variant="secondary">
                        {item.priority}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        item.owner_type === "me"
                          ? "border-blue-300 text-blue-700 bg-blue-50"
                          : "border-amber-300 text-amber-700 bg-amber-50"
                      }
                    >
                      {item.owner_type === "me"
                        ? item.person_name
                          ? `My task → for ${item.person_name}`
                          : "My task"
                        : item.person_name
                          ? `${item.person_name} does this`
                          : "They do it"}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {item.due_hint && <span>Due: {item.due_hint}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleEditing(index)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No action items were extracted from this transcript.</p>
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
            {saving ? "Saving..." : `Confirm ${acceptedCount} Items`}
          </Button>
        </div>
      )}
    </div>
  );
}
