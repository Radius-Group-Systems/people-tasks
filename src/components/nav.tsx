"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/people", label: "People" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/waiting", label: "Waiting On" },
  { href: "/encounters", label: "Encounters" },
  { href: "/import", label: "Import" },
  { href: "/search", label: "Search" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-8">
          <Link href="/" className="font-semibold text-lg">
            PeopleTasks
          </Link>
          <div className="flex gap-1">
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
        </div>
      </div>
    </nav>
  );
}
