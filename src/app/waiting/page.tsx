"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionItemCard } from "@/components/action-item-card";
import { ActionItem } from "@/lib/types";
import { UsersIcon, FolderKanbanIcon } from "lucide-react";

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
  const [personFilter, setPersonFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

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

  // Unique people across all statuses
  const allPeople = useMemo(() => {
    const names = new Set<string>();
    for (const items of Object.values(itemsByStatus)) {
      for (const item of items) {
        if (item.person_name) names.add(item.person_name);
      }
    }
    return Array.from(names).sort();
  }, [itemsByStatus]);

  const allProjects = useMemo(() => {
    const names = new Set<string>();
    for (const items of Object.values(itemsByStatus)) {
      for (const item of items) {
        if (item.project_name) names.add(item.project_name);
      }
    }
    return Array.from(names).sort();
  }, [itemsByStatus]);

  function filterItems(items: ActionItem[]) {
    let filtered = items;
    if (personFilter !== "all") filtered = filtered.filter((i) => i.person_name === personFilter);
    if (projectFilter === "_none") filtered = filtered.filter((i) => !i.project_name);
    else if (projectFilter !== "all") filtered = filtered.filter((i) => i.project_name === projectFilter);
    return filtered;
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  function renderGrouped(items: ActionItem[], emptyMessage: string) {
    const filtered = filterItems(items);
    if (!filtered || filtered.length === 0) {
      return <p className="text-muted-foreground">{emptyMessage}</p>;
    }
    // If filtering by person, skip the grouping
    if (personFilter !== "all") {
      return (
        <div className="space-y-2">
          {filtered.map((item) => (
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
    const grouped = groupByPerson(filtered);
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

  const openCount = filterItems(itemsByStatus.open || []).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Waiting On ({openCount})</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={personFilter} onValueChange={setPersonFilter}>
            <SelectTrigger className="w-[200px]">
              <UsersIcon className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All people</SelectItem>
              {allPeople.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]">
              <FolderKanbanIcon className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="_none">No project</SelectItem>
              {allProjects.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({filterItems(itemsByStatus[s] || []).length})
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
