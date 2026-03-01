"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActionItemCard } from "@/components/action-item-card";
import { PersonAvatar } from "@/components/person-avatar";
import { Person, ActionItem, Encounter, TalkingPoint, Project } from "@/lib/types";
import { toNoonUTC, toDateInputValue, formatDateDisplay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  ClipboardListIcon,
  ClockIcon,
  MessageSquareIcon,
  SparklesIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  PlusIcon,
  XIcon,
  CalendarIcon,
  StickyNoteIcon,
  ListIcon,
  FolderKanbanIcon,
} from "lucide-react";

interface RelatedContext {
  title: string;
  excerpt: string;
  encounter_id: number;
}

interface PrepData {
  person: Person;
  my_open_items: ActionItem[];
  their_open_items: ActionItem[];
  recent_encounters: Encounter[];
  related_context: RelatedContext[];
  shared_projects: Project[];
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const days = Math.floor((now - then) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function daysUntil(dateStr: string) {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const days = Math.ceil((target - now) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days}d`;
}

export default function MeetingPrepPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = use(params);
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable prep state
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [newPointText, setNewPointText] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/prep?person_id=${personId}`);
      if (!res.ok) throw new Error("Failed to load prep data");
      const prepData: PrepData = await res.json();
      setData(prepData);

      // Initialize editable fields from person data
      const p = prepData.person;
      setNextMeetingDate(p.next_meeting_at ? toDateInputValue(p.next_meeting_at) : "");
      setPrepNotes(p.prep_notes || "");
      setTalkingPoints(p.talking_points || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-save prep fields with debounce
  const savePrepFields = useCallback(
    (fields: { prep_notes?: string; talking_points?: TalkingPoint[]; next_meeting_at?: string | null }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/people/${personId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          });
        } catch (err) {
          console.error("Failed to save prep:", err);
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [personId]
  );

  function handleNotesChange(text: string) {
    setPrepNotes(text);
    savePrepFields({ prep_notes: text });
  }

  function handleMeetingDateChange(date: string) {
    setNextMeetingDate(date);
    savePrepFields({ next_meeting_at: date ? toNoonUTC(date) : null });
  }

  function handleAddTalkingPoint() {
    if (!newPointText.trim()) return;
    const updated = [...talkingPoints, {
      id: crypto.randomUUID(),
      text: newPointText.trim(),
      done: false,
    }];
    setTalkingPoints(updated);
    setNewPointText("");
    savePrepFields({ talking_points: updated });
  }

  function handleTogglePoint(id: string) {
    const updated = talkingPoints.map((tp) =>
      tp.id === id ? { ...tp, done: !tp.done } : tp
    );
    setTalkingPoints(updated);
    savePrepFields({ talking_points: updated });
  }

  function handleRemovePoint(id: string) {
    const updated = talkingPoints.filter((tp) => tp.id !== id);
    setTalkingPoints(updated);
    savePrepFields({ talking_points: updated });
  }

  function handlePointTextChange(id: string, text: string) {
    const updated = talkingPoints.map((tp) =>
      tp.id === id ? { ...tp, text } : tp
    );
    setTalkingPoints(updated);
    savePrepFields({ talking_points: updated });
  }

  function handleTaskUpdate() {
    fetch(`/api/prep?person_id=${personId}`)
      .then((r) => r.json())
      .then((d: PrepData) => {
        setData(d);
      })
      .catch(console.error);
  }

  if (loading) return <div className="text-muted-foreground">Loading prep...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return <div className="text-muted-foreground">No data found.</div>;

  const { person, my_open_items, their_open_items, recent_encounters, related_context, shared_projects } = data;
  const lastEncounter = recent_encounters[0];
  const pendingPoints = talkingPoints.filter((tp) => !tp.done).length;

  // Tasks due specifically for this next meeting
  const dueNextMeeting = [
    ...my_open_items.filter((i) => i.due_trigger === "next_meeting"),
    ...their_open_items.filter((i) => i.due_trigger === "next_meeting"),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/people/${personId}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <PersonAvatar name={person.name} photoUrl={person.photo_url} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">Prep: {person.name}</h1>
            <p className="text-muted-foreground text-sm">
              {person.organization && `${person.organization} · `}
              {lastEncounter
                ? `Last met ${timeAgo(lastEncounter.occurred_at)}`
                : "No previous meetings"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {saving && <span className="text-muted-foreground text-xs">Saving...</span>}
        </div>
      </div>

      {/* Next meeting date */}
      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Next meeting</span>
          <Input
            type="date"
            value={nextMeetingDate}
            onChange={(e) => handleMeetingDateChange(e.target.value)}
            className="h-8 w-[170px] text-sm"
          />
          {nextMeetingDate && (
            <>
              <span className="text-sm text-muted-foreground">
                {formatDateDisplay(toNoonUTC(nextMeetingDate))} ({daysUntil(toNoonUTC(nextMeetingDate))})
              </span>
              <button
                onClick={() => handleMeetingDateChange("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Due for this meeting — prominent callout */}
      {dueNextMeeting.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
              <CalendarIcon className="w-5 h-5" />
              Due for this meeting ({dueNextMeeting.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dueNextMeeting.map((item) => (
                <ActionItemCard key={item.id} item={item} onUpdate={handleTaskUpdate} showPerson={false} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Editable prep + tasks */}
        <div className="space-y-6">
          {/* Talking Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListIcon className="w-5 h-5" />
                Talking Points
                {pendingPoints > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">({pendingPoints})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {talkingPoints.map((tp) => (
                  <div key={tp.id} className="flex items-start gap-2 group/tp py-0.5">
                    <button
                      onClick={() => handleTogglePoint(tp.id)}
                      className={cn(
                        "mt-1 w-4 h-4 rounded border flex-shrink-0 transition-colors flex items-center justify-center",
                        tp.done
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-green-400"
                      )}
                    >
                      {tp.done && (
                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <input
                      value={tp.text}
                      onChange={(e) => handlePointTextChange(tp.id, e.target.value)}
                      className={cn(
                        "flex-1 bg-transparent border-none outline-none text-sm py-0",
                        tp.done && "line-through text-muted-foreground"
                      )}
                    />
                    <button
                      onClick={() => handleRemovePoint(tp.id)}
                      className="text-muted-foreground/40 hover:text-red-500 opacity-0 group-hover/tp:opacity-100 transition-opacity mt-0.5"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <PlusIcon className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <input
                  value={newPointText}
                  onChange={(e) => setNewPointText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddTalkingPoint(); }
                  }}
                  placeholder="Add a talking point..."
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/40"
                />
              </div>
            </CardContent>
          </Card>

          {/* Free-form notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <StickyNoteIcon className="w-5 h-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prepNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="What do you want to cover? Context, goals, things to remember..."
                rows={5}
                className="resize-none text-sm"
              />
            </CardContent>
          </Card>

          {/* Open tasks I need to discuss */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardListIcon className="w-5 h-5" />
                My open items ({my_open_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {my_open_items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing pending on your end.</p>
              ) : (
                <div className="space-y-2">
                  {my_open_items.map((item) => (
                    <ActionItemCard key={item.id} item={item} onUpdate={handleTaskUpdate} showPerson={false} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Things I'm waiting on */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Waiting on {person.name} ({their_open_items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {their_open_items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing pending from {person.name}.</p>
              ) : (
                <div className="space-y-2">
                  {their_open_items.map((item) => (
                    <ActionItemCard key={item.id} item={item} onUpdate={handleTaskUpdate} showPerson={false} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Context */}
        <div className="space-y-6">
          {/* Last encounter summary */}
          {lastEncounter && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquareIcon className="w-5 h-5" />
                  Last Meeting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/encounters/${lastEncounter.id}`}
                    className="font-medium hover:text-primary hover:underline transition-colors flex items-center gap-1"
                  >
                    {lastEncounter.title}
                    <ExternalLinkIcon className="w-3 h-3" />
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(lastEncounter.occurred_at)}
                  </span>
                </div>
                {lastEncounter.summary ? (
                  <p className="text-sm text-muted-foreground">{lastEncounter.summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No summary available.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shared projects */}
          {shared_projects && shared_projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderKanbanIcon className="w-5 h-5" />
                  Shared Projects ({shared_projects.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shared_projects.map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{proj.name}</p>
                        {(proj.open_count ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {proj.open_count} open / {proj.task_count} total
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Meeting history */}
          {recent_encounters.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meeting History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recent_encounters.slice(1).map((enc) => (
                    <div key={enc.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/encounters/${enc.id}`}
                          className="text-sm font-medium hover:text-primary hover:underline transition-colors"
                        >
                          {enc.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {new Date(enc.occurred_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                          {" · "}{enc.encounter_type}
                        </p>
                        {enc.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{enc.summary}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related context from other meetings */}
          {related_context.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5" />
                  Mentioned Elsewhere
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {related_context.map((ctx) => (
                    <div key={ctx.encounter_id}>
                      <Link
                        href={`/encounters/${ctx.encounter_id}`}
                        className="text-sm font-medium hover:text-primary hover:underline transition-colors flex items-center gap-1"
                      >
                        {ctx.title}
                        <ExternalLinkIcon className="w-3 h-3" />
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{ctx.excerpt}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
