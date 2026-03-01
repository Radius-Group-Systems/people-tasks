"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "@/lib/use-hotkeys";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts";

export function GlobalShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const pendingGo = useRef<number | null>(null);

  // "G" prefix for go-to shortcuts
  const handleGo = useCallback((target: string) => {
    router.push(target);
  }, [router]);

  useHotkeys([
    {
      key: "n",
      handler: () => {
        // Click the quick capture button if it exists
        const btn = document.querySelector("[data-quick-capture-trigger]") as HTMLButtonElement;
        if (btn) btn.click();
      },
    },
    {
      key: "?",
      shift: true,
      handler: () => setShowHelp(true),
    },
    {
      key: "/",
      handler: () => {
        const searchInput = document.querySelector("[data-search-input]") as HTMLInputElement;
        if (searchInput) searchInput.focus();
        else router.push("/search");
      },
    },
    // G+key combos using a timer approach
    { key: "g", handler: () => {
      if (pendingGo.current) clearTimeout(pendingGo.current);
      pendingGo.current = window.setTimeout(() => { pendingGo.current = null; }, 500);
    }},
    { key: "h", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/"); } }},
    { key: "p", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/people"); } }},
    { key: "r", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/projects"); } }},
    { key: "t", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/tasks"); } }},
    { key: "w", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/waiting"); } }},
    { key: "e", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/encounters"); } }},
    { key: "s", handler: () => { if (pendingGo.current) { clearTimeout(pendingGo.current); pendingGo.current = null; handleGo("/search"); } }},
  ]);

  return <KeyboardShortcutsDialog open={showHelp} onClose={() => setShowHelp(false)} />;
}
