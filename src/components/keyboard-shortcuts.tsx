"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["N"], description: "Quick capture new task" },
  { keys: ["G", "H"], description: "Go to Today (Home)" },
  { keys: ["G", "P"], description: "Go to People" },
  { keys: ["G", "R"], description: "Go to Projects" },
  { keys: ["G", "T"], description: "Go to My Tasks" },
  { keys: ["G", "W"], description: "Go to Waiting On" },
  { keys: ["G", "E"], description: "Go to Encounters" },
  { keys: ["G", "S"], description: "Go to Search" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((s) => (
            <div
              key={s.description}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm">{s.description}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 text-xs font-mono bg-muted rounded border min-w-[24px] text-center"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
