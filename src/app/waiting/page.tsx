"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItemCard } from "@/components/action-item-card";
import { ActionItem } from "@/lib/types";

const STATUSES = ["open", "in_progress", "snoozed", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  snoozed: "Snoozed",
  done: "Done",
};

function groupByPerson(items: ActionItem[]) {
  const grouped: Record<string, ActionItem[]> = {};
  for (const item of items) {
    const name = item.person_name || "Unassigned";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(item);
  }
  return grouped;
}

export default function WaitingOnPage() {
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.all(
        STATUSES.map((s) =>
          fetch(`/api/action-items?owner_type=them&status=${s}`).then((r) => r.json())
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

  function renderGrouped(items: ActionItem[], emptyMessage: string) {
    if (!items || items.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>;
    }
    const grouped = groupByPerson(items);
    return Object.entries(grouped).map(([personName, personItems]) => (
      <Card key={personName}>
        <CardHeader>
          <CardTitle className="text-lg">
            {personName} ({personItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {personItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onUpdate={fetchData}
                showPerson={false}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    ));
  }

  const openCount = (itemsByStatus.open || []).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Waiting On ({openCount})</h1>

      <Tabs defaultValue="open">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({(itemsByStatus[s] || []).length})
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUSES.map((s) => (
          <TabsContent key={s} value={s} className="mt-4 space-y-4">
            {renderGrouped(
              itemsByStatus[s] || [],
              s === "open"
                ? "No one owes you anything right now."
                : s === "done"
                  ? "No completed items."
                  : `No ${STATUS_LABELS[s].toLowerCase()} items.`
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
