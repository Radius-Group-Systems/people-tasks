"use client";

import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/person-avatar";
import { Person } from "@/lib/types";
import { ChevronsUpDownIcon, CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonPickerProps {
  people: Person[];
  value: string; // person id as string, or ""
  onSelect: (personId: string) => void;
  onPersonCreated?: (person: Person) => void;
  placeholder?: string;
  myPersonId?: string | null;
  showForPrefix?: boolean;
  className?: string;
}

export function PersonPicker({
  people,
  value,
  onSelect,
  onPersonCreated,
  placeholder = "Select person...",
  myPersonId,
  showForPrefix = false,
  className,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = people.find((p) => p.id.toString() === value);

  // Filter people by search
  const filtered = search.trim()
    ? people.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.organization?.toLowerCase().includes(search.toLowerCase())
      )
    : people;

  // Sort: me first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.id.toString() === myPersonId) return -1;
    if (b.id.toString() === myPersonId) return 1;
    return a.name.localeCompare(b.name);
  });

  // Check if search text matches no one exactly (for "add new" prompt)
  const exactMatch = people.some(
    (p) => p.name.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = search.trim().length >= 2 && !exactMatch;

  async function handleCreate() {
    if (!search.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: search.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const newPerson: Person = await res.json();
      onPersonCreated?.(newPerson);
      onSelect(newPerson.id.toString());
      setSearch("");
      setOpen(false);
    } catch (err) {
      console.error("Failed to create person:", err);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (open) {
      // Small delay so popover renders first
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const displayLabel = selected
    ? (showForPrefix ? `For ${selected.name}` : selected.name) +
      (selected.id.toString() === myPersonId ? " (Me)" : "")
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDownIcon className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 z-[60] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Search or add..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate && sorted.length === 0) {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto overscroll-contain">
          {sorted.map((person) => {
            const isMe = person.id.toString() === myPersonId;
            const isSelected = person.id.toString() === value;
            return (
              <button
                key={person.id}
                onClick={() => {
                  onSelect(person.id.toString());
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <PersonAvatar name={person.name} photoUrl={person.photo_url} size="sm" />
                <span className="flex-1 truncate">
                  {showForPrefix ? `For ${person.name}` : person.name}
                  {isMe && " (Me)"}
                </span>
                {isSelected && (
                  <CheckIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
              </button>
            );
          })}

          {sorted.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
          )}

          {canCreate && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left border-t"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0" style={{ minWidth: 32, minHeight: 32 }}>
                <PlusIcon className="w-4 h-4" />
              </div>
              <span className="flex-1 truncate">
                {creating ? "Adding..." : `Add "${search.trim()}"`}
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
