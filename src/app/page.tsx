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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickCapture } from "@/components/quick-capture";
import { ActionItemCard } from "@/components/action-item-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionItem, Project } from "@/lib/types";
import { toDateInputValue } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  UsersIcon,
  FlameIcon,
  CalendarIcon,
  AlertTriangleIcon,
  ClockIcon,
  FolderKanbanIcon,
  FilterIcon,
  XIcon,
  InboxIcon,
  HourglassIcon,
  SparklesIcon,
} from "lucide-react";

interface CalEvent {
  id: number;
  google_event_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  matched_people?: { person_id: number; person_name: string }[];
}

type ViewMode = "focus" | "all" | "by-priority" | "by-project";

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDueCategory(item: ActionItem): "overdue" | "today" | "upcoming" | "later" | "none" {
  const dueDate = item.due_at || (item.due_trigger === "next_meeting" ? item.next_meeting_date : null);
  if (!dueDate) return "none";
  const dueDateStr = toDateInputValue(dueDate);
  const todayStr = getTodayStr();
  if (dueDateStr < todayStr) return "overdue";
  if (dueDateStr === todayStr) return "today";
  // Within the next 3 days
  const due = new Date(dueDateStr + "T12:00:00Z");
  const now = new Date(todayStr + "T12:00:00Z");
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 3) return "upcoming";
  return "later";
}

export default function TodayPage() {
  const router = useRouter();
  const [allTasks, setAllTasks] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [startingMeeting, setStartingMeeting] = useState<number | null>(null);

  // Filters
  const [viewMode, setViewMode] = useState<ViewMode>("focus");
  const [personFilter, setPersonFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all"); // "all" | "me" | "them"
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch both open and in_progress tasks
      const [openRes, ipRes, projRes] = await Promise.all([
        fetch("/api/action-items?status=open"),
        fetch("/api/action-items?status=in_progress"),
        fetch("/api/projects?status=active"),
      ]);
      const open: ActionItem[] = await openRes.json();
      const inProgress: ActionItem[] = await ipRes.json();
      setAllTasks([...open, ...inProgress]);
      setProjects(await projRes.json());

      // Fetch calendar events (non-blocking)
      const calRes = await fetch("/api/calendar?view=today").catch(() => null);
      const calEvents = calRes?.ok ? await calRes.json() : [];
      setCalendarEvents(Array.isArray(calEvents) ? calEvents : []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived filter options
  const filterPeople = useMemo(() => {
    const names = new Set<string>();
    for (const item of allTasks) {
      if (item.person_name) names.add(item.person_name);
    }
    return Array.from(names).sort();
  }, [allTasks]);

  const filterProjects = useMemo(() => {
    const projs = new Map<string, string>();
    for (const item of allTasks) {
      if (item.project_id && item.project_name) {
        projs.set(String(item.project_id), item.project_name);
      }
    }
    return Array.from(projs.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allTasks]);

  // Apply base filters
  const filtered = useMemo(() => {
    let items = allTasks;
    if (ownerFilter !== "all") items = items.filter((i) => i.owner_type === ownerFilter);
    if (personFilter !== "all") {
      if (personFilter === "_none") items = items.filter((i) => !i.person_name);
      else items = items.filter((i) => i.person_name === personFilter);
    }
    if (priorityFilter !== "all") items = items.filter((i) => i.priority === priorityFilter);
    if (projectFilter !== "all") {
      if (projectFilter === "_none") items = items.filter((i) => !i.project_id);
      else items = items.filter((i) => String(i.project_id) === projectFilter);
    }
    return items;
  }, [allTasks, ownerFilter, personFilter, priorityFilter, projectFilter]);

  // Smart groupings for focus view
  const focusGroups = useMemo(() => {
    const overdue: ActionItem[] = [];
    const urgent: ActionItem[] = [];
    const dueToday: ActionItem[] = [];
    const highPri: ActionItem[] = [];
    const upcoming: ActionItem[] = [];
    const rest: ActionItem[] = [];

    for (const item of filtered) {
      const cat = getDueCategory(item);
      if (cat === "overdue") { overdue.push(item); continue; }
      if (item.priority === "urgent") { urgent.push(item); continue; }
      if (cat === "today") { dueToday.push(item); continue; }
      if (item.priority === "high") { highPri.push(item); continue; }
      if (cat === "upcoming") { upcoming.push(item); continue; }
      rest.push(item);
    }

    return { overdue, urgent, dueToday, highPri, upcoming, rest };
  }, [filtered]);

  // Priority groups
  const priorityGroups = useMemo(() => {
    const groups: Record<string, ActionItem[]> = { urgent: [], high: [], normal: [], low: [] };
    for (const item of filtered) {
      (groups[item.priority] || groups.normal).push(item);
    }
    return groups;
  }, [filtered]);

  // Project groups
  const projectGroups = useMemo(() => {
    const groups = new Map<string, { name: string; color: string; items: ActionItem[] }>();
    groups.set("_none", { name: "No Project", color: "#94a3b8", items: [] });
    for (const item of filtered) {
      const key = item.project_id ? String(item.project_id) : "_none";
      if (!groups.has(key)) {
        const proj = projects.find((p) => p.id === item.project_id);
        groups.set(key, { name: item.project_name || "Unknown", color: proj?.color || "#94a3b8", items: [] });
      }
      groups.get(key)!.items.push(item);
    }
    // Remove empty "No Project"
    if (groups.get("_none")!.items.length === 0) groups.delete("_none");
    return groups;
  }, [filtered, projects]);

  // Counts for summary chips
  const counts = useMemo(() => {
    const myTasks = allTasks.filter((i) => i.owner_type === "me");
    const waiting = allTasks.filter((i) => i.owner_type === "them");
    const urgentHigh = allTasks.filter((i) => i.priority === "urgent" || i.priority === "high");
    const overdue = allTasks.filter((i) => getDueCategory(i) === "overdue");
    const dueToday = allTasks.filter((i) => getDueCategory(i) === "today");
    return {
      total: allTasks.length,
      myTasks: myTasks.length,
      waiting: waiting.length,
      urgentHigh: urgentHigh.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
    };
  }, [allTasks]);

  const activeFilterCount = [
    ownerFilter !== "all",
    personFilter !== "all",
    priorityFilter !== "all",
    projectFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setOwnerFilter("all");
    setPersonFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
  }

  async function startMeeting(event: CalEvent) {
    setStartingMeeting(event.id);
    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          encounter_type: "meeting",
          occurred_at: event.starts_at,
          source: "calendar",
          participant_ids: event.matched_people?.map((p) => p.person_id) || [],
          calendar_event_id: event.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to create encounter");
      const encounter = await res.json();
      router.push(`/encounters/${encounter.id}`);
    } catch (err) {
      console.error("Failed to start meeting:", err);
      setStartingMeeting(null);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground py-12 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <SummaryChip
          icon={InboxIcon}
          label="My Tasks"
          count={counts.myTasks}
          active={ownerFilter === "me"}
          onClick={() => setOwnerFilter(ownerFilter === "me" ? "all" : "me")}
        />
        <SummaryChip
          icon={HourglassIcon}
          label="Waiting On"
          count={counts.waiting}
          active={ownerFilter === "them"}
          onClick={() => setOwnerFilter(ownerFilter === "them" ? "all" : "them")}
          color="amber"
        />
        {counts.overdue > 0 && (
          <SummaryChip
            icon={AlertTriangleIcon}
            label="Overdue"
            count={counts.overdue}
            active={false}
            onClick={() => { setViewMode("focus"); clearFilters(); }}
            color="red"
          />
        )}
        {counts.urgentHigh > 0 && (
          <SummaryChip
            icon={FlameIcon}
            label="Urgent/High"
            count={counts.urgentHigh}
            active={priorityFilter === "urgent" || priorityFilter === "high"}
            onClick={() => {
              if (priorityFilter === "urgent") setPriorityFilter("all");
              else setPriorityFilter("urgent");
            }}
            color="orange"
          />
        )}
        {counts.dueToday > 0 && (
          <SummaryChip
            icon={CalendarIcon}
            label="Due Today"
            count={counts.dueToday}
            active={false}
            onClick={() => { setViewMode("focus"); clearFilters(); }}
            color="blue"
          />
        )}
      </div>

      {/* Calendar events */}
      {calendarEvents.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Today&apos;s Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {calendarEvents.map((event) => {
                const startTime = new Date(event.starts_at);
                const now = new Date();
                const minsUntil = Math.round((startTime.getTime() - now.getTime()) / 60000);
                const timeLabel = minsUntil > 0 && minsUntil <= 120
                  ? `in ${minsUntil}m`
                  : minsUntil > 120
                    ? `in ${Math.round(minsUntil / 60)}h`
                    : minsUntil >= -60
                      ? "now"
                      : null;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex-shrink-0 border rounded-lg p-3 min-w-[200px] hover:border-primary/40 transition-colors",
                      timeLabel === "now" && "border-green-300 bg-green-50",
                      minsUntil > 0 && minsUntil <= 30 && "border-amber-300 bg-amber-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {startTime.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      {timeLabel && (
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          timeLabel === "now" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {timeLabel}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-sm mt-0.5">
                      {event.title}
                    </div>
                    {event.matched_people && event.matched_people.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
                        {event.matched_people.map((p) => (
                          <Link
                            key={p.person_id}
                            href={`/people/${p.person_id}`}
                          >
                            <Badge
                              variant="outline"
                              className="text-[10px] cursor-pointer hover:bg-muted"
                            >
                              {p.person_name}
                            </Badge>
                          </Link>
                        ))}
                        {event.matched_people.length === 1 && (
                          <Link
                            href={`/prep/${event.matched_people[0].person_id}`}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <SparklesIcon className="w-2.5 h-2.5" />
                            Prep
                          </Link>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => startMeeting(event)}
                      disabled={startingMeeting === event.id}
                      className="mt-2 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      {startingMeeting === event.id ? "Starting..." : "Start Meeting"}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <QuickCapture onCreated={fetchData} />

      {/* View mode tabs + filter toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5 min-w-max">
            {([
              { key: "focus", label: "Focus", icon: FlameIcon },
              { key: "all", label: "All", icon: InboxIcon },
              { key: "by-priority", label: "By Priority", icon: AlertTriangleIcon },
              { key: "by-project", label: "By Project", icon: FolderKanbanIcon },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  viewMode === key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "gap-1.5 text-xs flex-shrink-0",
            activeFilterCount > 0 && "border-primary text-primary"
          )}
        >
          <FilterIcon className="w-3 h-3" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 w-4 p-0 justify-center text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Expandable filter bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 items-center p-3 bg-muted/50 rounded-lg border">
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="me">My tasks</SelectItem>
              <SelectItem value="them">Waiting on</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {filterPeople.length > 0 && (
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
                <UsersIcon className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                <SelectItem value="_none">No person</SelectItem>
                {filterPeople.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterProjects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
                <FolderKanbanIcon className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="_none">No project</SelectItem>
                {filterProjects.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1">
              <XIcon className="w-3 h-3" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {allTasks.length} tasks
      </p>

      {/* FOCUS VIEW — smart groupings */}
      {viewMode === "focus" && (
        <div className="space-y-4">
          <FocusSection
            title="Overdue"
            icon={AlertTriangleIcon}
            iconColor="text-red-500"
            badgeColor="bg-red-100 text-red-700"
            items={focusGroups.overdue}
            onUpdate={fetchData}
          />
          <FocusSection
            title="Urgent"
            icon={FlameIcon}
            iconColor="text-red-500"
            badgeColor="bg-red-100 text-red-700"
            items={focusGroups.urgent}
            onUpdate={fetchData}
          />
          <FocusSection
            title="Due Today"
            icon={CalendarIcon}
            iconColor="text-blue-500"
            badgeColor="bg-blue-100 text-blue-700"
            items={focusGroups.dueToday}
            onUpdate={fetchData}
          />
          <FocusSection
            title="High Priority"
            icon={AlertTriangleIcon}
            iconColor="text-orange-500"
            badgeColor="bg-orange-100 text-orange-700"
            items={focusGroups.highPri}
            onUpdate={fetchData}
          />
          <FocusSection
            title="Due Soon"
            icon={ClockIcon}
            iconColor="text-amber-500"
            badgeColor="bg-amber-100 text-amber-700"
            items={focusGroups.upcoming}
            onUpdate={fetchData}
          />
          <FocusSection
            title="Everything Else"
            icon={InboxIcon}
            iconColor="text-muted-foreground"
            badgeColor="bg-gray-100 text-gray-700"
            items={focusGroups.rest}
            onUpdate={fetchData}
            defaultCollapsed
          />
          {filtered.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No open tasks. Nice work.
            </p>
          )}
        </div>
      )}

      {/* ALL VIEW — flat list */}
      {viewMode === "all" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No tasks match your filters.
            </p>
          ) : (
            filtered.map((item) => (
              <ActionItemCard key={item.id} item={item} onUpdate={fetchData} />
            ))
          )}
        </div>
      )}

      {/* BY PRIORITY VIEW */}
      {viewMode === "by-priority" && (
        <div className="space-y-4">
          {(["urgent", "high", "normal", "low"] as const).map((pri) => {
            const items = priorityGroups[pri];
            if (items.length === 0) return null;
            const conf = {
              urgent: { label: "Urgent", color: "bg-red-100 text-red-700", icon: FlameIcon, iconColor: "text-red-500" },
              high: { label: "High", color: "bg-orange-100 text-orange-700", icon: AlertTriangleIcon, iconColor: "text-orange-500" },
              normal: { label: "Normal", color: "bg-gray-100 text-gray-700", icon: InboxIcon, iconColor: "text-muted-foreground" },
              low: { label: "Low", color: "bg-gray-50 text-gray-500", icon: ClockIcon, iconColor: "text-muted-foreground" },
            }[pri];
            return (
              <FocusSection
                key={pri}
                title={conf.label}
                icon={conf.icon}
                iconColor={conf.iconColor}
                badgeColor={conf.color}
                items={items}
                onUpdate={fetchData}
              />
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No tasks match your filters.
            </p>
          )}
        </div>
      )}

      {/* BY PROJECT VIEW */}
      {viewMode === "by-project" && (
        <div className="space-y-4">
          {Array.from(projectGroups.entries()).map(([key, group]) => {
            if (group.items.length === 0) return null;
            return (
              <Card key={key}>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <CardTitle className="text-sm">{group.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.items.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {group.items.map((item) => (
                    <ActionItemCard key={item.id} item={item} onUpdate={fetchData} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No tasks match your filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  color = "default",
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: "default" | "red" | "orange" | "amber" | "blue";
}) {
  const colorMap = {
    default: active ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted/80",
    red: active ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100",
    orange: active ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100",
    amber: active ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
    blue: active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        colorMap[color],
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </button>
  );
}

function FocusSection({
  title,
  icon: Icon,
  iconColor,
  badgeColor,
  items,
  onUpdate,
  defaultCollapsed = false,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  badgeColor: string;
  items: ActionItem[];
  onUpdate: () => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-4 h-4", iconColor)} />
            <CardTitle className="text-sm">{title}</CardTitle>
            <Badge className={cn("text-[10px] border-0", badgeColor)}>
              {items.length}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {collapsed ? "Show" : "Hide"}
          </span>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0 space-y-2">
          {items.map((item) => (
            <ActionItemCard key={item.id} item={item} onUpdate={onUpdate} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
