"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPicker } from "@/components/person-picker";
import { Person } from "@/lib/types";
import { toNoonUTC } from "@/lib/date-utils";

interface QuickCaptureProps {
  onCreated?: () => void;
  defaultPersonId?: number;
}

export function QuickCapture({ onCreated, defaultPersonId }: QuickCaptureProps) {
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState<string>(
    defaultPersonId ? defaultPersonId.toString() : ""
  );
  const [forPersonId, setForPersonId] = useState<string>("");
  const [ownerType, setOwnerType] = useState<string>("me");
  const [dueTrigger, setDueTrigger] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("my-person-id");
    if (stored) setMyPersonId(stored);

    if (!defaultPersonId) {
      fetch("/api/people")
        .then((r) => r.json())
        .then((data: Person[]) => {
          setPeople(data);
          // Default to "me" if my-person-id is set
          if (stored) {
            setPersonId(stored);
          }
        })
        .catch(console.error);
    }
  }, [defaultPersonId]);

  function handlePersonCreated(newPerson: Person) {
    setPeople((prev) => [...prev, newPerson].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // person_id = the person this task relates to
    // When on a person's page (defaultPersonId), that person is always the context
    // Otherwise: "I do it" uses forPersonId, "They do it" uses the Who picker
    let effectivePersonId: number | null = null;
    let sourcePersonId: number | null = null;

    if (defaultPersonId) {
      // On a person's page: the task is always about/for that person
      effectivePersonId = defaultPersonId;
      // If "I do it", that person implicitly asked for it
      if (ownerType === "me") {
        sourcePersonId = defaultPersonId;
      }
    } else if (ownerType === "them") {
      effectivePersonId = personId ? parseInt(personId) : null;
    } else {
      effectivePersonId = forPersonId ? parseInt(forPersonId) : null;
    }

    setSubmitting(true);
    try {
      await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          person_id: effectivePersonId,
          source_person_id: sourcePersonId,
          owner_type: ownerType,
          due_trigger: dueTrigger === "none" ? null : dueTrigger,
          due_at: dueTrigger === "date" && dueDate ? toNoonUTC(dueDate) : null,
        }),
      });
      setTitle("");
      setPersonId(defaultPersonId ? defaultPersonId.toString() : (myPersonId || ""));
      setForPersonId("");
      setOwnerType("me");
      setDueTrigger("none");
      setDueDate("");
      onCreated?.();
    } catch (err) {
      console.error("Failed to create action item:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
      <Input
        placeholder="Quick capture: what needs to happen?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 min-w-[200px]"
        autoFocus
        data-quick-capture-trigger
      />
      {!defaultPersonId && (
        <PersonPicker
          people={people}
          value={personId}
          onSelect={(v) => {
            setPersonId(v);
            if (v !== myPersonId) {
              setOwnerType("them");
              setForPersonId("");
            } else {
              setOwnerType("me");
            }
          }}
          onPersonCreated={handlePersonCreated}
          placeholder="Who"
          myPersonId={myPersonId}
          className="w-[160px]"
        />
      )}
      <Select value={ownerType} onValueChange={setOwnerType}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="me">I do it</SelectItem>
          <SelectItem value="them">They do it</SelectItem>
        </SelectContent>
      </Select>
      {ownerType === "me" && !defaultPersonId && (
        <PersonPicker
          people={people.filter((p) => p.id.toString() !== myPersonId)}
          value={forPersonId}
          onSelect={setForPersonId}
          onPersonCreated={handlePersonCreated}
          placeholder="For..."
          showForPrefix
          className="w-[140px]"
        />
      )}
      <Select value={dueTrigger} onValueChange={setDueTrigger}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No deadline</SelectItem>
          <SelectItem value="date">By date</SelectItem>
          <SelectItem value="next_meeting">Next meeting</SelectItem>
        </SelectContent>
      </Select>
      {dueTrigger === "date" && (
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-[160px]"
        />
      )}
      <Button type="submit" disabled={submitting || !title.trim()}>
        Add
      </Button>
    </form>
  );
}
