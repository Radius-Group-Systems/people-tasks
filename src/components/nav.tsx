"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/person-avatar";
import { Person } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/people", label: "People" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/waiting", label: "Waiting On" },
  { href: "/encounters", label: "Encounters" },
  { href: "/import", label: "Import" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const [me, setMe] = useState<Person | null>(null);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const myId = localStorage.getItem("my-person-id");
    fetch("/api/people")
      .then((r) => r.json())
      .then((people: Person[]) => {
        setAllPeople(people);
        if (myId) {
          const found = people.find((p) => String(p.id) === String(myId));
          setMe(found || null);
        }
      })
      .catch(console.error);
  }, []);

  // Listen for identity changes (e.g., set from Today page banner)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === "my-person-id" && e.newValue) {
        const found = allPeople.find((p) => String(p.id) === e.newValue);
        if (found) setMe(found);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [allPeople]);

  function handleSelectMe(person: Person) {
    localStorage.setItem("my-person-id", person.id.toString());
    setMe(person);
    setPickerOpen(false);
    // Reload so all components pick up the new identity
    window.location.reload();
  }

  return (
    <nav className="border-b bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-8">
          <Link href="/" className="font-semibold text-lg">
            PeopleTasks
          </Link>
          <div className="flex gap-1 flex-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Identity indicator */}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition-colors text-sm">
                {me ? (
                  <>
                    <PersonAvatar name={me.name} photoUrl={me.photo_url} size="sm" />
                    <span className="hidden sm:inline text-muted-foreground">{me.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-xs">Set identity</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-1" align="end">
              <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                {me ? "Switch identity" : "Who are you?"}
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {allPeople.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectMe(person)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left",
                      me?.id === person.id && "bg-muted"
                    )}
                  >
                    <PersonAvatar name={person.name} photoUrl={person.photo_url} size="sm" />
                    <span className="truncate">{person.name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </nav>
  );
}
