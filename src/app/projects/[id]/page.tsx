"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PersonAvatar } from "@/components/person-avatar";
import { PersonPicker } from "@/components/person-picker";
import {
  Project,
  ProjectMember,
  Milestone,
  ActionItem,
  Encounter,
  Person,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  MilestoneIcon,
  UsersIcon,
  CalendarIcon,
  ListTodoIcon,
  MessageSquareIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200" },
  on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-700 border-amber-200" },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 border-blue-200" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-500 border-gray-200" },
};

const MILESTONE_STATUS: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "text-muted-foreground" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  completed: { label: "Completed", color: "text-green-600" },
};

const TASK_STATUS_ICON: Record<string, React.ElementType> = {
  open: CircleIcon,
  in_progress: ClockIcon,
  done: CheckCircle2Icon,
  snoozed: ClockIcon,
  cancelled: Trash2Icon,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600",
  high: "text-orange-600",
  normal: "text-foreground",
  low: "text-muted-foreground",
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<
    Project & {
      members: ProjectMember[];
      milestones: (Milestone & { task_count: number; done_count: number })[];
      tasks: ActionItem[];
      encounters: Encounter[];
    }
  | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");

  // Add member
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");

  // Add milestone
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newMsTitle, setNewMsTitle] = useState("");
  const [newMsDesc, setNewMsDesc] = useState("");
  const [newMsDate, setNewMsDate] = useState("");

  // Add task
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState<string>("");
  const [newTaskPersonId, setNewTaskPersonId] = useState("");
  const [newTaskOwnerType, setNewTaskOwnerType] = useState("me");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");

  useEffect(() => {
    fetchProject();
    fetchPeople();
  }, [id]);

  async function fetchProject() {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    setProject(await res.json());
  }

  async function fetchPeople() {
    const res = await fetch("/api/people");
    setPeople(await res.json());
  }

  async function handleSaveEdit() {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDesc || null,
        status: editStatus,
        color: editColor,
        target_date: editTargetDate || null,
      }),
    });
    setEditing(false);
    fetchProject();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projects");
  }

  async function handleAddMember() {
    if (!newMemberId) return;
    await fetch(`/api/projects/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: parseInt(newMemberId), role: newMemberRole }),
    });
    setAddMemberOpen(false);
    setNewMemberId("");
    setNewMemberRole("member");
    fetchProject();
  }

  async function handleRemoveMember(personId: number) {
    await fetch(`/api/projects/${id}/members?person_id=${personId}`, {
      method: "DELETE",
    });
    fetchProject();
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsTitle.trim()) return;
    await fetch(`/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newMsTitle.trim(),
        description: newMsDesc || null,
        target_date: newMsDate || null,
      }),
    });
    setNewMsTitle("");
    setNewMsDesc("");
    setNewMsDate("");
    setAddMilestoneOpen(false);
    fetchProject();
  }

  async function handleMilestoneStatus(msId: number, status: string) {
    await fetch(`/api/projects/${id}/milestones/${msId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProject();
  }

  async function handleDeleteMilestone(msId: number) {
    await fetch(`/api/projects/${id}/milestones/${msId}`, {
      method: "DELETE",
    });
    fetchProject();
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await fetch("/api/action-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTaskTitle.trim(),
        project_id: parseInt(id),
        milestone_id: newTaskMilestoneId ? parseInt(newTaskMilestoneId) : null,
        person_id: newTaskPersonId ? parseInt(newTaskPersonId) : null,
        owner_type: newTaskOwnerType,
        priority: newTaskPriority,
      }),
    });
    setNewTaskTitle("");
    setNewTaskMilestoneId("");
    setNewTaskPersonId("");
    setNewTaskOwnerType("me");
    setNewTaskPriority("normal");
    setAddTaskOpen(false);
    fetchProject();
  }

  async function handleTaskStatus(taskId: number, status: string) {
    await fetch(`/api/action-items/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProject();
  }

  if (!project) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  const statusConf = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  const taskCount = project.task_count ?? 0;
  const doneCount = project.done_count ?? 0;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

  const COLOR_OPTIONS = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#6366f1",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
          <ArrowLeftIcon className="w-4 h-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <Badge variant="outline" className={cn("flex-shrink-0", statusConf.color)}>
              {statusConf.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground mt-1 ml-7">{project.description}</p>
          )}

          {/* Progress bar */}
          {taskCount > 0 && (
            <div className="ml-7 mt-3 max-w-md">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{doneCount}/{taskCount} tasks complete</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: project.color }}
                />
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="ml-7 mt-2 flex gap-4 text-xs text-muted-foreground">
            {project.start_date && (
              <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
            )}
            {project.target_date && (
              <span>Target: {new Date(project.target_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(project.name);
              setEditDesc(project.description || "");
              setEditStatus(project.status);
              setEditColor(project.color);
              setEditTargetDate(project.target_date || "");
              setEditing(true);
            }}
          >
            <PencilIcon className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2Icon className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tasks and encounters will be unlinked (not deleted). Members and milestones will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      editColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Target Date</Label>
              <Input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-1">
            <ListTodoIcon className="w-3.5 h-3.5" />
            Tasks ({project.tasks?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1">
            <MilestoneIcon className="w-3.5 h-3.5" />
            Milestones ({project.milestones?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1">
            <UsersIcon className="w-3.5 h-3.5" />
            Team ({project.members?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="encounters" className="gap-1">
            <MessageSquareIcon className="w-3.5 h-3.5" />
            Meetings ({project.encounters?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="w-3 h-3 mr-1" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task to Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTask} className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Who</Label>
                      <Select value={newTaskOwnerType} onValueChange={setNewTaskOwnerType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="me">I need to do this</SelectItem>
                          <SelectItem value="them">They need to do this</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Person</Label>
                    <PersonPicker
                      people={people}
                      value={newTaskPersonId}
                      onSelect={(v) => setNewTaskPersonId(v)}
                      onPersonCreated={(p) => setPeople((prev) => [...prev, p])}
                      placeholder="Assign to..."
                    />
                  </div>
                  {project.milestones && project.milestones.length > 0 && (
                    <div>
                      <Label>Milestone</Label>
                      <Select value={newTaskMilestoneId} onValueChange={setNewTaskMilestoneId}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {project.milestones.map((ms) => (
                            <SelectItem key={ms.id} value={String(ms.id)}>
                              {ms.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full">Add Task</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Grouped by milestone */}
          {project.milestones && project.milestones.length > 0 && (
            <>
              {project.milestones.map((ms) => {
                const msTasks = (project.tasks || []).filter(
                  (t) => t.milestone_id === ms.id
                );
                if (msTasks.length === 0) return null;
                return (
                  <div key={ms.id} className="space-y-2">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <MilestoneIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {ms.title}
                    </h3>
                    {msTasks.map((task) => (
                      <TaskRow key={task.id} task={task} onStatusChange={handleTaskStatus} projectColor={project.color} />
                    ))}
                  </div>
                );
              })}
            </>
          )}

          {/* Ungrouped tasks */}
          {(() => {
            const ungrouped = (project.tasks || []).filter((t) => !t.milestone_id);
            if (ungrouped.length === 0 && (!project.milestones || project.milestones.length === 0)) {
              return (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No tasks yet. Add one to get started.
                </p>
              );
            }
            if (ungrouped.length === 0) return null;
            return (
              <div className="space-y-2">
                {project.milestones && project.milestones.length > 0 && (
                  <h3 className="text-sm font-medium text-muted-foreground">No milestone</h3>
                )}
                {ungrouped.map((task) => (
                  <TaskRow key={task.id} task={task} onStatusChange={handleTaskStatus} projectColor={project.color} />
                ))}
              </div>
            );
          })()}
        </TabsContent>

        {/* MILESTONES TAB */}
        <TabsContent value="milestones" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="w-3 h-3 mr-1" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Milestone</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddMilestone} className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newMsTitle}
                      onChange={(e) => setNewMsTitle(e.target.value)}
                      placeholder="MVP Launch"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newMsDesc}
                      onChange={(e) => setNewMsDesc(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Target Date</Label>
                    <Input type="date" value={newMsDate} onChange={(e) => setNewMsDate(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full">Add Milestone</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {(project.milestones || []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No milestones yet. Add milestones to organize work into phases.
            </p>
          ) : (
            <div className="space-y-3">
              {project.milestones.map((ms) => {
                const msStatus = MILESTONE_STATUS[ms.status] || MILESTONE_STATUS.upcoming;
                const msProg =
                  ms.task_count > 0
                    ? Math.round((ms.done_count / ms.task_count) * 100)
                    : 0;
                return (
                  <div
                    key={ms.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MilestoneIcon className={cn("w-4 h-4", msStatus.color)} />
                        <h3 className="font-semibold text-sm">{ms.title}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {msStatus.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Select
                          value={ms.status}
                          onValueChange={(v) => handleMilestoneStatus(ms.id, v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMilestone(ms.id)}
                        >
                          <Trash2Icon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {ms.description && (
                      <p className="text-xs text-muted-foreground">{ms.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {ms.target_date && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(ms.target_date).toLocaleDateString()}
                        </span>
                      )}
                      {ms.task_count > 0 && (
                        <span>
                          {ms.done_count}/{ms.task_count} tasks ({msProg}%)
                        </span>
                      )}
                    </div>
                    {ms.task_count > 0 && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${msProg}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="w-3 h-3 mr-1" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Person</Label>
                    <PersonPicker
                      people={people}
                      value={newMemberId}
                      onSelect={(v) => setNewMemberId(v)}
                      onPersonCreated={(p) => setPeople((prev) => [...prev, p])}
                      placeholder="Select person..."
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="stakeholder">Stakeholder</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddMember} className="w-full" disabled={!newMemberId}>
                    Add Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(project.members || []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No team members yet. Add people to track who&apos;s involved.
            </p>
          ) : (
            <div className="space-y-2">
              {project.members.map((m) => (
                <div
                  key={m.person_id}
                  className="flex items-center gap-3 border rounded-lg px-4 py-3"
                >
                  <PersonAvatar
                    name={m.person_name || "?"}
                    photoUrl={m.person_photo_url}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/people/${m.person_id}`}
                      className="font-medium text-sm hover:underline"
                    >
                      {m.person_name}
                    </Link>
                    <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                      {m.role}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(m.person_id)}
                  >
                    <Trash2Icon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ENCOUNTERS TAB */}
        <TabsContent value="encounters" className="space-y-4">
          {(project.encounters || []).length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No meetings linked to this project yet.
            </p>
          ) : (
            <div className="space-y-2">
              {project.encounters.map((enc) => (
                <Link
                  key={enc.id}
                  href={`/encounters/${enc.id}`}
                  className="flex items-center gap-3 border rounded-lg px-4 py-3 hover:border-primary/40 transition-colors"
                >
                  <MessageSquareIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{enc.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(enc.occurred_at).toLocaleDateString()} · {enc.encounter_type}
                    </div>
                  </div>
                  {enc.summary && (
                    <p className="text-xs text-muted-foreground max-w-[200px] truncate hidden md:block">
                      {enc.summary}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskRow({
  task,
  onStatusChange,
  projectColor,
}: {
  task: ActionItem;
  onStatusChange: (id: number, status: string) => void;
  projectColor: string;
}) {
  const StatusIcon = TASK_STATUS_ICON[task.status] || CircleIcon;
  const isDone = task.status === "done" || task.status === "cancelled";

  return (
    <div
      className={cn(
        "flex items-center gap-3 border rounded-lg px-4 py-2.5 transition-colors",
        isDone && "opacity-60"
      )}
    >
      <button
        onClick={() =>
          onStatusChange(task.id, task.status === "done" ? "open" : "done")
        }
        className="flex-shrink-0"
      >
        <StatusIcon
          className={cn(
            "w-4 h-4",
            task.status === "done" ? "text-green-500" : "text-muted-foreground"
          )}
          style={task.status === "open" ? { color: projectColor } : undefined}
        />
      </button>
      <div className="flex-1 min-w-0">
        <Link
          href={`/tasks`}
          className={cn(
            "text-sm font-medium hover:underline",
            isDone && "line-through",
            PRIORITY_COLORS[task.priority]
          )}
        >
          {task.title}
        </Link>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.person_name && <span>{task.person_name}</span>}
          {task.milestone_title && (
            <span className="flex items-center gap-0.5">
              <MilestoneIcon className="w-2.5 h-2.5" />
              {task.milestone_title}
            </span>
          )}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] capitalize flex-shrink-0",
          task.owner_type === "them" ? "border-amber-200 text-amber-700" : ""
        )}
      >
        {task.owner_type === "me" ? "mine" : "theirs"}
      </Badge>
    </div>
  );
}
