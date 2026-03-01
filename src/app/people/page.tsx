"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Person } from "@/lib/types";
import { PersonAvatar } from "@/components/person-avatar";
import { SearchIcon, ClipboardListIcon, ClockIcon, CheckCircle2Icon, AlertTriangleIcon, SparklesIcon, BarChart3Icon, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ImportContact {
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  slack_handle?: string | null;
}

type ImportStep = "search" | "review";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function PeoplePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newOrg, setNewOrg] = useState("");

  // Import state
  const [importStep, setImportStep] = useState<ImportStep>("search");
  const [macContacts, setMacContacts] = useState<ImportContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [reviewContacts, setReviewContacts] = useState<ImportContact[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchPeople();
  }, []);

  async function fetchPeople() {
    const res = await fetch("/api/people");
    setPeople(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        email: newEmail || null,
        organization: newOrg || null,
      }),
    });

    setNewName("");
    setNewEmail("");
    setNewOrg("");
    setDialogOpen(false);
    fetchPeople();
  }

  function resetImport() {
    setMacContacts([]);
    setSelected(new Set());
    setImportResult(null);
    setContactSearch("");
    setImportStep("search");
    setReviewContacts([]);
  }

  function handleContactSearchChange(value: string) {
    setContactSearch(value);
    setImportResult(null);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (value.trim().length < 2) {
      setMacContacts([]);
      setSelected(new Set());
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/people/mac-contacts?q=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) throw new Error("Failed to search");
        const contacts: ImportContact[] = await res.json();
        setMacContacts(contacts);
        setSelected(new Set());
      } catch {
        setImportResult("Failed to search Mac Contacts.");
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function handleVCardUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const vcf = ev.target?.result as string;
      // Parse VCard and go to review step
      try {
        const res = await fetch("/api/people/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vcf, dryRun: true }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.contacts && data.contacts.length > 0) {
          setReviewContacts(
            data.contacts.map((c: ImportContact) => ({
              ...c,
              slack_handle: c.slack_handle || "",
            }))
          );
          setImportStep("review");
        } else {
          setImportResult("No contacts found in VCard file.");
        }
      } catch {
        // Fallback: just import directly
        setImporting(true);
        const res2 = await fetch("/api/people/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vcf }),
        });
        const data = await res2.json();
        setImportResult(
          `Imported ${data.imported} contacts (${data.skipped} skipped)`
        );
        fetchPeople();
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }

  function toggleContact(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === macContacts.length && macContacts.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(macContacts.map((_, i) => i)));
    }
  }

  function goToReview() {
    const contacts = Array.from(selected).map((i) => ({
      ...macContacts[i],
      slack_handle: macContacts[i].slack_handle || "",
    }));
    setReviewContacts(contacts);
    setImportStep("review");
  }

  function updateReviewContact(idx: number, field: keyof ImportContact, value: string) {
    setReviewContacts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  function removeReviewContact(idx: number) {
    setReviewContacts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function importReviewed() {
    if (reviewContacts.length === 0) return;

    setImporting(true);
    try {
      const contacts = reviewContacts.map((c) => ({
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        organization: c.organization || null,
        slack_handle: c.slack_handle || null,
      }));

      const res = await fetch("/api/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      setImportResult(
        `Imported ${data.imported} contacts (${data.skipped} skipped as duplicates)`
      );
      setReviewContacts([]);
      setImportStep("search");
      setMacContacts([]);
      setSelected(new Set());
      setContactSearch("");
      fetchPeople();
    } catch {
      setImportResult("Failed to import contacts.");
    } finally {
      setImporting(false);
    }
  }

  const filtered = people.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.organization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">People</h1>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) resetImport();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">Import Contacts</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {importStep === "search"
                    ? "Import Contacts"
                    : "Review & Edit Before Importing"}
                </DialogTitle>
              </DialogHeader>

              {importStep === "search" ? (
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  {/* VCard upload */}
                  <div>
                    <Label htmlFor="vcf">Upload VCard (.vcf)</Label>
                    <Input
                      id="vcf"
                      type="file"
                      accept=".vcf,.vcard"
                      onChange={handleVCardUpload}
                      disabled={importing}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <Separator className="flex-1" />
                    <span className="text-sm text-muted-foreground">or</span>
                    <Separator className="flex-1" />
                  </div>

                  {/* Mac Contacts search */}
                  <div>
                    <Label>Search Mac Contacts</Label>
                    <Input
                      placeholder="Type a name to search your contacts..."
                      value={contactSearch}
                      onChange={(e) => handleContactSearchChange(e.target.value)}
                      autoFocus
                    />
                    {contactSearch.length > 0 && contactSearch.length < 2 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Type at least 2 characters to search
                      </p>
                    )}
                  </div>

                  {searching && (
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  )}

                  {macContacts.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {macContacts.length} contact
                          {macContacts.length !== 1 ? "s" : ""} found
                        </p>
                        <Button variant="ghost" size="sm" onClick={toggleAll}>
                          {selected.size === macContacts.length
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>

                      <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
                        {macContacts.map((contact, idx) => (
                          <label
                            key={idx}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(idx)}
                              onChange={() => toggleContact(idx)}
                              className="rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {contact.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {[
                                  contact.organization,
                                  contact.email,
                                  contact.phone,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      <Button
                        onClick={goToReview}
                        disabled={selected.size === 0}
                      >
                        Review & Edit ({selected.size})
                      </Button>
                    </>
                  )}

                  {!searching &&
                    contactSearch.length >= 2 &&
                    macContacts.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No contacts found matching &ldquo;{contactSearch}&rdquo;
                      </p>
                    )}

                  {importResult && (
                    <p className="text-sm text-muted-foreground">
                      {importResult}
                    </p>
                  )}
                </div>
              ) : (
                /* Review & Edit step */
                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                  <p className="text-sm text-muted-foreground">
                    Fill in any missing details. Slack handles won&apos;t be in
                    your Mac Contacts — add them now.
                  </p>

                  <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
                    {reviewContacts.map((contact, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{contact.name}</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeReviewContact(idx)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={contact.email || ""}
                                onChange={(e) =>
                                  updateReviewContact(idx, "email", e.target.value)
                                }
                                placeholder="email@example.com"
                                type="email"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Phone</Label>
                              <Input
                                value={contact.phone || ""}
                                onChange={(e) =>
                                  updateReviewContact(idx, "phone", e.target.value)
                                }
                                placeholder="(555) 123-4567"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Slack</Label>
                              <Input
                                value={contact.slack_handle || ""}
                                onChange={(e) =>
                                  updateReviewContact(
                                    idx,
                                    "slack_handle",
                                    e.target.value
                                  )
                                }
                                placeholder="@handle"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Organization</Label>
                              <Input
                                value={contact.organization || ""}
                                onChange={(e) =>
                                  updateReviewContact(
                                    idx,
                                    "organization",
                                    e.target.value
                                  )
                                }
                                placeholder="Company"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {reviewContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No contacts to import. Go back and select some.
                    </p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setImportStep("search")}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={importReviewed}
                      disabled={reviewContacts.length === 0 || importing}
                      className="flex-1"
                    >
                      {importing
                        ? "Importing..."
                        : `Import ${reviewContacts.length} Contact${reviewContacts.length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>

                  {importResult && (
                    <p className="text-sm text-muted-foreground">
                      {importResult}
                    </p>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Person</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Person</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Josiah"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="josiah@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="org">Organization</Label>
                  <Input
                    id="org"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Add
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Accountability stats */}
      {people.length > 0 && (() => {
        const totalTasks = people.reduce((s, p) => s + (p.open_items_count ?? 0), 0);
        const totalWaiting = people.reduce((s, p) => s + (p.waiting_on_count ?? 0), 0);
        const totalDone = people.reduce((s, p) => s + (p.done_count ?? 0), 0);
        const totalInProgress = people.reduce((s, p) => s + (p.in_progress_count ?? 0), 0);
        const totalAll = totalTasks + totalWaiting + totalDone + totalInProgress;
        const completionRate = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;
        const needsCheckin = people.filter((p) => {
          const days = p.last_encounter_at
            ? Math.floor((Date.now() - new Date(p.last_encounter_at).getTime()) / 86400000)
            : Infinity;
          return days > 14 && ((p.waiting_on_count ?? 0) > 0 || (p.open_items_count ?? 0) > 0);
        }).length;
        const topWaiting = people
          .filter((p) => (p.waiting_on_count ?? 0) > 0)
          .sort((a, b) => (b.waiting_on_count ?? 0) - (a.waiting_on_count ?? 0))
          .slice(0, 3);

        return (
          <div className="flex gap-4 p-4 bg-muted/50 rounded-lg flex-wrap items-center">
            <div className="flex items-center gap-2">
              <BarChart3Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Overview</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span><strong className="text-blue-600">{totalTasks}</strong> open</span>
              <span><strong className="text-violet-600">{totalInProgress}</strong> in progress</span>
              <span><strong className="text-amber-600">{totalWaiting}</strong> waiting</span>
              <span><strong className="text-green-600">{totalDone}</strong> done</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUpIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{completionRate}% completion rate</span>
            </div>
            {needsCheckin > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                <AlertTriangleIcon className="w-3 h-3 mr-1" />
                {needsCheckin} need check-in
              </Badge>
            )}
            {topWaiting.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Most waiting:
                {topWaiting.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">
                    {p.name} ({p.waiting_on_count})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((person) => {
          const tasks = person.open_items_count ?? 0;
          const waiting = person.waiting_on_count ?? 0;
          const inProgress = person.in_progress_count ?? 0;
          const done = person.done_count ?? 0;
          const totalActive = tasks + waiting + inProgress;
          const encounters = person.encounter_count ?? 0;

          // Time since last encounter
          const lastMet = person.last_encounter_at
            ? timeAgo(new Date(person.last_encounter_at))
            : null;
          const daysSinceContact = person.last_encounter_at
            ? Math.floor((Date.now() - new Date(person.last_encounter_at).getTime()) / 86400000)
            : Infinity;

          // Attention level
          const needsCheckin = daysSinceContact > 14 && (waiting > 0 || tasks > 0);
          const highWaiting = waiting >= 4;

          // Avatar ring color
          const ringColor = needsCheckin || highWaiting
            ? "ring-amber-400"
            : totalActive > 0
              ? "ring-blue-400"
              : "ring-transparent";

          // Activity bar segments (max 8 for visual scale)
          const barMax = 8;

          return (
            <Link key={person.id} href={`/people/${person.id}`}>
              <div className={cn(
                "border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full",
                needsCheckin && "border-amber-200 bg-amber-50/30",
              )}>
                {/* Top row: avatar + name */}
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    name={person.name}
                    photoUrl={person.photo_url}
                    size="md"
                    ringColor={ringColor}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{person.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {[person.organization, person.email].filter(Boolean).join(" · ") || "\u00A0"}
                    </p>
                  </div>
                </div>

                {/* Activity bar */}
                {totalActive > 0 ? (
                  <div className="mt-3 flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted">
                    {tasks > 0 && (
                      <div
                        className="bg-blue-500 rounded-full"
                        style={{ width: `${Math.min((tasks / barMax) * 100, 100)}%` }}
                        title={`${tasks} open task${tasks !== 1 ? "s" : ""}`}
                      />
                    )}
                    {inProgress > 0 && (
                      <div
                        className="bg-violet-500 rounded-full"
                        style={{ width: `${Math.min((inProgress / barMax) * 100, 100)}%` }}
                        title={`${inProgress} in progress`}
                      />
                    )}
                    {waiting > 0 && (
                      <div
                        className="bg-amber-500 rounded-full"
                        style={{ width: `${Math.min((waiting / barMax) * 100, 100)}%` }}
                        title={`${waiting} waiting`}
                      />
                    )}
                  </div>
                ) : done > 0 ? (
                  <div className="mt-3 flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-muted">
                    <div className="bg-green-400 rounded-full w-full" />
                  </div>
                ) : (
                  <div className="mt-3 h-1.5 rounded-full bg-muted" />
                )}

                {/* Stats row */}
                <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {tasks > 0 && (
                    <span className="flex items-center gap-1">
                      <ClipboardListIcon className="w-3 h-3 text-blue-500" />
                      <span className="font-medium text-foreground">{tasks}</span> task{tasks !== 1 ? "s" : ""}
                    </span>
                  )}
                  {waiting > 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-3 h-3 text-amber-500" />
                      <span className={cn("font-medium", highWaiting ? "text-amber-600" : "text-foreground")}>{waiting}</span> waiting
                    </span>
                  )}
                  {done > 0 && tasks === 0 && waiting === 0 && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2Icon className="w-3 h-3 text-green-500" />
                      all clear
                    </span>
                  )}
                  {totalActive === 0 && done === 0 && (
                    <span className="text-muted-foreground/60">no activity</span>
                  )}
                </div>

                {/* Last met + attention */}
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  {lastMet ? (
                    <span className={cn(
                      "text-muted-foreground",
                      daysSinceContact > 14 && "text-amber-600",
                    )}>
                      {encounters} meeting{encounters !== 1 ? "s" : ""} · last {lastMet}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">no meetings yet</span>
                  )}
                  {needsCheckin && (
                    <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                      <AlertTriangleIcon className="w-3 h-3" />
                      check in
                    </span>
                  )}
                  {totalActive > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/prep/${person.id}`);
                      }}
                      className="flex items-center gap-0.5 text-primary/60 hover:text-primary font-medium ml-auto transition-colors"
                    >
                      <SparklesIcon className="w-3 h-3" />
                      prep
                    </button>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          {people.length === 0
            ? "No people yet. Add someone or import contacts to get started."
            : "No results found."}
        </p>
      )}
    </div>
  );
}
