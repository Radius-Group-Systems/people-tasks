"use client";

import { useEffect } from "react";

type HotkeyHandler = (e: KeyboardEvent) => void;

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: HotkeyHandler;
  // Don't fire when typing in an input/textarea
  ignoreInputs?: boolean;
}

export function useHotkeys(hotkeys: HotkeyConfig[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      for (const hotkey of hotkeys) {
        if (hotkey.ignoreInputs !== false && isInput) continue;

        const keyMatch = e.key.toLowerCase() === hotkey.key.toLowerCase();
        const ctrlMatch = hotkey.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const metaMatch = hotkey.meta ? e.metaKey : true;
        const shiftMatch = hotkey.shift ? e.shiftKey : !e.shiftKey;

        // For plain letter keys, make sure no modifiers are pressed
        if (!hotkey.ctrl && !hotkey.meta && (e.ctrlKey || e.metaKey || e.altKey)) continue;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          e.preventDefault();
          hotkey.handler(e);
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hotkeys]);
}
