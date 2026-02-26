"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItemCard } from "@/components/action-item-card";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItem } from "@/lib/types";
import { UsersIcon } from "lucide-react";

const STATUSES = ["open", "in_progress", "snoozed", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  snoozed: "Snoozed",
  done: "Done",
};

export default function TasksPage() {
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        STATUSES.map((s) =>
          fetch(`/api/action-items?owner_type=me&status=${s}`).then((r) => r.json())
        )
      );
      const map: Record<string, ActionItem[]> = {};
      STATUSES.forEach((s, i) => (map[s] = results[i]));
      setItemsByStatus(map);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unique people across all statuses (who tasks are "for")
  const allPeople = useMemo(() => {
    const names = new Set<string>();
    for (const items of Object.values(itemsByStatus)) {
      for (const item of items) {
        if (item.person_name) names.add(item.person_name);
      }
    }
    return Array.from(names).sort();
  }, [itemsByStatus]);

  function filterItems(items: ActionItem[]) {
    if (personFilter === "all") return items;
    if (personFilter === "_none") return items.filter((i) => !i.person_name);
    return items.filter((i) => i.person_name === personFilter);
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  function renderList(items: ActionItem[], emptyMessage: string) {
    const filtered = filterItems(items);
    if (!filtered || filtered.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>;
    }
    return (
      <div className="space-y-2">
        {filtered.map((item) => (
          <ActionItemCard key={item.id} item={item} onUpdate={fetchData} />
        ))}
      </div>
    );
  }

  const openCount = filterItems(itemsByStatus.open || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks ({openCount})</h1>
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger className="w-[200px]">
            <UsersIcon className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All people</SelectItem>
            <SelectItem value="_none">No person (just me)</SelectItem>
            {allPeople.map((name) => (
              <SelectItem key={name} value={name}>
                For {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuickCapture onCreated={fetchData} />

      <Tabs defaultValue="open">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({filterItems(itemsByStatus[s] || []).length})
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUSES.map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {renderList(
              itemsByStatus[s] || [],
              s === "open"
                ? "All clear."
                : s === "done"
                  ? "Nothing completed yet."
                  : `No ${STATUS_LABELS[s].toLowerCase()} tasks.`
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
