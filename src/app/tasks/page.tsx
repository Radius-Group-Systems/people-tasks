"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItemCard } from "@/components/action-item-card";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItem } from "@/lib/types";

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

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  function renderList(items: ActionItem[], emptyMessage: string) {
    if (!items || items.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ActionItemCard key={item.id} item={item} onUpdate={fetchData} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Tasks</h1>

      <QuickCapture onCreated={fetchData} />

      <Tabs defaultValue="open">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({(itemsByStatus[s] || []).length})
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
