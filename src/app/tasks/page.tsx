"use client";

import { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionItemCard } from "@/components/action-item-card";
import { QuickCapture } from "@/components/quick-capture";
import { Badge } from "@/components/ui/badge";
import { ActionItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  UsersIcon,
  FolderKanbanIcon,
  LayoutListIcon,
  KanbanIcon,
  AlertTriangleIcon,
  CalendarIcon,
  CalendarDaysIcon,
  InboxIcon,
  ChevronRightIcon,
} from "lucide-react";
import { sectionAndSort, TaskSection } from "@/lib/task-urgency";

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

const SECTION_CONFIG: Record<
  TaskSection,
  { icon: typeof AlertTriangleIcon; color: string; headerColor: string }
> = {
  overdue: {
    icon: AlertTriangleIcon,
    color: "text-red-600",
    headerColor: "border-red-200 bg-red-50",
  },
  today: {
    icon: CalendarIcon,
    color: "text-amber-600",
    headerColor: "border-amber-200 bg-amber-50",
  },
  tomorrow: {
    icon: CalendarIcon,
    color: "text-blue-600",
    headerColor: "",
  },
  this_week: {
    icon: CalendarDaysIcon,
    color: "text-indigo-600",
    headerColor: "",
  },
  later: {
    icon: CalendarIcon,
    color: "text-muted-foreground",
    headerColor: "",
  },
  no_date: {
    icon: InboxIcon,
    color: "text-muted-foreground",
    headerColor: "",
  },
};

type ViewMode = "list" | "kanban";

export default function TasksPage() {
  const [allItems, setAllItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const items = await fetch(
        `/api/action-items?owner_type=me&status=all`
      ).then((r) => r.json());
      setAllItems(items);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Partition items by status
  const { active, snoozed, done, itemsByStatus } = useMemo(() => {
    const active: ActionItem[] = [];
    const snoozed: ActionItem[] = [];
    const done: ActionItem[] = [];
    const itemsByStatus: Record<string, ActionItem[]> = {
      open: [],
      in_progress: [],
      snoozed: [],
      done: [],
    };

    for (const item of allItems) {
      itemsByStatus[item.status]?.push(item);
      if (item.status === "open" || item.status === "in_progress") {
        active.push(item);
      } else if (item.status === "snoozed") {
        snoozed.push(item);
      } else if (item.status === "done") {
        done.push(item);
      }
    }

    return { active, snoozed, done, itemsByStatus };
  }, [allItems]);

  const allPeople = useMemo(() => {
    const names = new Set<string>();
    for (const item of allItems) {
      if (item.person_name) names.add(item.person_name);
    }
    return Array.from(names).sort();
  }, [allItems]);

  const allProjects = useMemo(() => {
    const names = new Set<string>();
    for (const item of allItems) {
      if (item.project_name) names.add(item.project_name);
    }
    return Array.from(names).sort();
  }, [allItems]);

  function filterItems(items: ActionItem[]) {
    let filtered = items;
    if (personFilter === "_none")
      filtered = filtered.filter((i) => !i.person_name);
    else if (personFilter !== "all")
      filtered = filtered.filter((i) => i.person_name === personFilter);
    if (projectFilter === "_none")
      filtered = filtered.filter((i) => !i.project_name);
    else if (projectFilter !== "all")
      filtered = filtered.filter((i) => i.project_name === projectFilter);
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

  const filteredActive = filterItems(active);
  const sections = sectionAndSort(filteredActive);
  const filteredSnoozed = filterItems(snoozed);
  const filteredDone = filterItems(done);
  const activeCount = filteredActive.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Tasks ({activeCount})</h1>
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
              Focus
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

      {/* Focus View */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Active tasks grouped by urgency */}
          {sections.length === 0 && (
            <p className="text-muted-foreground py-8 text-center">
              All clear — nothing needs your attention.
            </p>
          )}

          {sections.map(({ section, label, items }) => {
            const config = SECTION_CONFIG[section];
            const Icon = config.icon;
            return (
              <div key={section}>
                <div
                  className={cn(
                    "flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md",
                    config.headerColor
                  )}
                >
                  <Icon className={cn("w-4 h-4", config.color)} />
                  <span
                    className={cn("text-sm font-semibold", config.color)}
                  >
                    {label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] ml-1"
                  >
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      item={item}
                      onUpdate={fetchData}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Snoozed — collapsible */}
          {filteredSnoozed.length > 0 && (
            <div>
              <button
                onClick={() => setShowSnoozed(!showSnoozed)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ChevronRightIcon
                  className={cn(
                    "w-4 h-4 transition-transform",
                    showSnoozed && "rotate-90"
                  )}
                />
                Snoozed
                <Badge variant="secondary" className="text-[10px]">
                  {filteredSnoozed.length}
                </Badge>
              </button>
              {showSnoozed && (
                <div className="space-y-2 mt-2">
                  {filteredSnoozed.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      item={item}
                      onUpdate={fetchData}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Done — collapsible */}
          {filteredDone.length > 0 && (
            <div>
              <button
                onClick={() => setShowDone(!showDone)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ChevronRightIcon
                  className={cn(
                    "w-4 h-4 transition-transform",
                    showDone && "rotate-90"
                  )}
                />
                Completed
                <Badge variant="secondary" className="text-[10px]">
                  {filteredDone.length}
                </Badge>
              </button>
              {showDone && (
                <div className="space-y-2 mt-2">
                  {filteredDone.map((item) => (
                    <ActionItemCard
                      key={item.id}
                      item={item}
                      onUpdate={fetchData}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      STATUS_COLORS[status]
                    )}
                  />
                  <span className="text-sm font-medium">
                    {STATUS_LABELS[status]}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] ml-auto"
                  >
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
                      <ActionItemCard item={item} onUpdate={fetchData} />
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
