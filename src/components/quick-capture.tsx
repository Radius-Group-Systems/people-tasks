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
import { Person } from "@/lib/types";

interface QuickCaptureProps {
  onCreated?: () => void;
  defaultPersonId?: number;
}

export function QuickCapture({ onCreated, defaultPersonId }: QuickCaptureProps) {
  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState<string>(
    defaultPersonId ? defaultPersonId.toString() : ""
  );
  const [ownerType, setOwnerType] = useState<string>("me");
  const [dueTrigger, setDueTrigger] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!defaultPersonId) {
      fetch("/api/people")
        .then((r) => r.json())
        .then(setPeople)
        .catch(console.error);
    }
  }, [defaultPersonId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          person_id: personId ? parseInt(personId) : null,
          owner_type: ownerType,
          due_trigger: dueTrigger === "none" ? null : dueTrigger,
          due_at: dueTrigger === "date" && dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      setTitle("");
      setPersonId(defaultPersonId ? defaultPersonId.toString() : "");
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
    <form onSubmit={handleSubmit} className="flex gap-2 items-center flex-wrap">
      <Input
        placeholder="Quick capture: what needs to happen?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 min-w-[200px]"
        autoFocus
      />
      {!defaultPersonId && (
        <Select value={personId} onValueChange={setPersonId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Person" />
          </SelectTrigger>
          <SelectContent>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
