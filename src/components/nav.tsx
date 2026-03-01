"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/person-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MenuIcon, XIcon, LogOutIcon } from "lucide-react";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/people", label: "People" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/waiting", label: "Waiting On" },
  { href: "/encounters", label: "Encounters" },
  { href: "/import", label: "Import" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Don't render nav on auth pages
  if (pathname === "/login" || pathname === "/register" || pathname === "/onboarding") {
    return null;
  }

  return (
    <nav className="border-b bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-4">
          <Link href="/" className="font-semibold text-lg flex-shrink-0">
            PeopleTasks
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-auto p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-1 flex-1">
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

          {/* User menu (desktop) */}
          <div className="hidden md:block">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted transition-colors text-sm">
                  {session?.user ? (
                    <>
                      <PersonAvatar name={session.user.name || "User"} photoUrl={session.user.image || undefined} size="sm" />
                      <span className="hidden sm:inline text-muted-foreground">{session.user.name || session.user.email}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">Loading...</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1" align="end">
                {session?.user && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
                    {session.user.email}
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left text-destructive"
                >
                  <LogOutIcon className="w-4 h-4" />
                  Sign out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t py-2 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* User info + sign out in mobile menu */}
            <div className="border-t mt-2 pt-2 px-3">
              {session?.user && (
                <div className="text-xs text-muted-foreground mb-2">{session.user.email}</div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-destructive w-full"
              >
                <LogOutIcon className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
