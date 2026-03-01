"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/components/person-avatar";
import { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  PlusIcon,
  FolderKanbanIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  MilestoneIcon,
  PauseCircleIcon,
  ArchiveIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200", icon: FolderKanbanIcon },
  on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-700 border-amber-200", icon: PauseCircleIcon },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle2Icon },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-500 border-gray-200", icon: ArchiveIcon },
};

const COLOR_OPTIONS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#6366f1",
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [filterStatus]);

  async function fetchProjects() {
    const params = new URLSearchParams();
    if (filterStatus && filterStatus !== "all") params.set("status", filterStatus);
    const res = await fetch(`/api/projects?${params}`);
    setProjects(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);

    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc || null,
        color: newColor,
        target_date: newTargetDate || null,
      }),
    });

    setNewName("");
    setNewDesc("");
    setNewColor("#3b82f6");
    setNewTargetDate("");
    setDialogOpen(false);
    setCreating(false);
    fetchProjects();
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-1" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="proj-name">Name</Label>
                <Input
                  id="proj-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Q1 Product Launch"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="proj-desc">Description</Label>
                <Textarea
                  id="proj-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What's this project about?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-transform",
                        newColor === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="proj-target">Target Date</Label>
                <Input
                  id="proj-target"
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((project) => {
          const statusConf = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
          const taskCount = project.task_count ?? 0;
          const doneCount = project.done_count ?? 0;
          const openCount = project.open_count ?? 0;
          const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
          const members = project.members || [];

          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full flex flex-col">
                {/* Header with color bar */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", statusConf.color)}>
                    {statusConf.label}
                  </Badge>
                </div>

                {/* Progress bar */}
                {taskCount > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{doneCount}/{taskCount} tasks</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  {openCount > 0 && (
                    <span className="flex items-center gap-1">
                      <ClipboardListIcon className="w-3 h-3" />
                      {openCount} open
                    </span>
                  )}
                  {(project.milestone_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <MilestoneIcon className="w-3 h-3" />
                      {project.milestone_count}
                    </span>
                  )}
                  {project.next_milestone && (
                    <span className="truncate text-[10px]">
                      Next: {project.next_milestone}
                    </span>
                  )}
                </div>

                {/* Members */}
                {members.length > 0 && (
                  <div className="mt-3 flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {members.slice(0, 5).map((m) => (
                        <PersonAvatar
                          key={m.person_id}
                          name={m.person_name || "?"}
                          photoUrl={m.person_photo_url}
                          size="sm"
                          className="border-2 border-background"
                        />
                      ))}
                    </div>
                    {members.length > 5 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{members.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Target date */}
                {project.target_date && (
                  <div className="mt-auto pt-3 text-[10px] text-muted-foreground">
                    Target: {new Date(project.target_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {projects.length === 0 ? (
            <div className="space-y-2">
              <FolderKanbanIcon className="w-12 h-12 mx-auto opacity-30" />
              <p>No projects yet.</p>
              <p className="text-sm">Create your first project to start organizing work across people.</p>
            </div>
          ) : (
            <p>No projects match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
