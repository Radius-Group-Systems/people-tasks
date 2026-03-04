"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/person-avatar";
import { RadiusWordmark } from "@/components/radius-brand";
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
    <nav className="border-b border-[#E7E5E4] bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          <Link href="/" className="flex-shrink-0 group">
            <RadiusWordmark
              subBrand="GROUP"
              variant="horizontal"
              colorMode="dark"
              size="sm"
            />
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-auto p-2 text-[#91918B] hover:text-foreground transition-colors duration-150"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-0.5 flex-1">
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
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#252525] text-white"
                      : "text-[#91918B] hover:text-[#252525] hover:bg-[#F5F5F4]"
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
                <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#F5F5F4] transition-colors duration-150 text-sm">
                  {session?.user ? (
                    <>
                      <PersonAvatar name={session.user.name || "User"} photoUrl={session.user.image || undefined} size="sm" />
                      <span className="hidden sm:inline text-[#91918B]">{session.user.name || session.user.email}</span>
                    </>
                  ) : (
                    <span className="text-[#91918B] text-xs">Loading...</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1" align="end">
                {session?.user && (
                  <div className="px-2 py-1.5 text-xs text-[#91918B] border-b border-[#E7E5E4] mb-1">
                    {session.user.email}
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-[#F5F5F4] transition-colors duration-150 text-left text-[#9B2C2C]"
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
          <div className="md:hidden border-t border-[#E7E5E4] py-2 space-y-0.5">
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
                    "block px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#252525] text-white"
                      : "text-[#91918B] hover:text-[#252525] hover:bg-[#F5F5F4]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* User info + sign out in mobile menu */}
            <div className="border-t border-[#E7E5E4] mt-2 pt-2 px-3">
              {session?.user && (
                <div className="text-xs text-[#91918B] mb-2">{session.user.email}</div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-[#F5F5F4] transition-colors duration-150 text-[#9B2C2C] w-full"
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
