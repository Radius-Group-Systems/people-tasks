"use client";

import { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ActionItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UsersIcon, FolderKanbanIcon, LayoutListIcon, KanbanIcon } from "lucide-react";

const STATUSES = ["open", "in_progress", "snoozed", "done"] as const;

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  snoozed: "Snoozed",
  done: "Done",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-violet-500",
  snoozed: "bg-amber-500",
  done: "bg-green-500",
};

type ViewMode = "list" | "kanban";

export default function TasksPage() {
  const [itemsByStatus, setItemsByStatus] = useState<Record<string, ActionItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

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
    if (personFilter === "_none") filtered = filtered.filter((i) => !i.person_name);
    else if (personFilter !== "all") filtered = filtered.filter((i) => i.person_name === personFilter);
    if (projectFilter === "_none") filtered = filtered.filter((i) => !i.project_name);
    else if (projectFilter !== "all") filtered = filtered.filter((i) => i.project_name === projectFilter);
    return filtered;
  }

  async function moveToStatus(itemId: number, newStatus: string) {
    await fetch(`/api/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchData();
  }

  function onDragStart(e: DragEvent, itemId: number) {
    setDraggingId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId.toString());
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
  }

  function onColumnDragOver(e: DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }

  function onColumnDragLeave() {
    setDragOverColumn(null);
  }

  function onColumnDrop(e: DragEvent, status: string) {
    e.preventDefault();
    const itemId = parseInt(e.dataTransfer.getData("text/plain"));
    if (!isNaN(itemId)) {
      moveToStatus(itemId, status);
    }
    setDragOverColumn(null);
    setDraggingId(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Tasks ({openCount})</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutListIcon className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              Board
            </button>
          </div>
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

      <QuickCapture onCreated={fetchData} />

      {/* List View */}
      {viewMode === "list" && (
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
      )}

      {/* Kanban Board View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[400px]">
          {STATUSES.map((status) => {
            const items = filterItems(itemsByStatus[status] || []);
            return (
              <div
                key={status}
                onDragOver={(e) => onColumnDragOver(e, status)}
                onDragLeave={onColumnDragLeave}
                onDrop={(e) => onColumnDrop(e, status)}
                className={cn(
                  "bg-muted/30 rounded-lg border-2 border-transparent transition-colors p-3",
                  dragOverColumn === status && "border-primary/40 bg-primary/5"
                )}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[status])} />
                  <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {items.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, item.id)}
                      onDragEnd={onDragEnd}
                      className={cn(
                        "cursor-grab active:cursor-grabbing",
                        draggingId === item.id && "opacity-40"
                      )}
                    >
                      <ActionItemCard
                        item={item}
                        onUpdate={fetchData}
                      />
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Drop tasks here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
