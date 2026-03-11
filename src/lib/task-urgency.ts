import { ActionItem } from "./types";
import { toDateInputValue, formatDateDisplay } from "./date-utils";

/**
 * Calculate days until due. Negative = overdue. null = no deadline.
 */
export function daysUntilDue(item: ActionItem): number | null {
  const effectiveDue =
    item.due_at ||
    (item.due_trigger === "next_meeting" ? item.next_meeting_date : null);
  if (!effectiveDue) return null;

  const dueStr = toDateInputValue(effectiveDue);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const dueDate = new Date(dueStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Urgency score for sorting within sections (higher = more urgent).
 */
function getUrgencyScore(item: ActionItem): number {
  const days = daysUntilDue(item);
  const pw = PRIORITY_WEIGHT[item.priority] || 2;

  if (days === null) return pw;
  if (days < 0) return 100 + pw + Math.abs(days);
  if (days === 0) return 50 + pw;
  if (days === 1) return 45 + pw;
  if (days <= 7) return 20 + pw + (7 - days);
  return 10 + pw;
}

export type TaskSection =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this_week"
  | "later"
  | "no_date";

export interface SectionedTasks {
  section: TaskSection;
  label: string;
  items: ActionItem[];
}

/**
 * Group active tasks into time-based sections, sorted by urgency within each.
 */
export function sectionAndSort(items: ActionItem[]): SectionedTasks[] {
  const buckets: Record<TaskSection, ActionItem[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    no_date: [],
  };

  for (const item of items) {
    const days = daysUntilDue(item);
    if (days === null) buckets.no_date.push(item);
    else if (days < 0) buckets.overdue.push(item);
    else if (days === 0) buckets.today.push(item);
    else if (days === 1) buckets.tomorrow.push(item);
    else if (days <= 7) buckets.this_week.push(item);
    else buckets.later.push(item);
  }

  const sortFn = (a: ActionItem, b: ActionItem) =>
    getUrgencyScore(b) - getUrgencyScore(a);
  for (const bucket of Object.values(buckets)) bucket.sort(sortFn);

  const sections: { section: TaskSection; label: string }[] = [
    { section: "overdue", label: "Overdue" },
    { section: "today", label: "Due Today" },
    { section: "tomorrow", label: "Tomorrow" },
    { section: "this_week", label: "This Week" },
    { section: "later", label: "Later" },
    { section: "no_date", label: "No Deadline" },
  ];

  return sections
    .filter((s) => buckets[s.section].length > 0)
    .map((s) => ({ ...s, items: buckets[s.section] }));
}

/**
 * Format a due date as a relative label with appropriate color class.
 */
export function formatRelativeDue(dueAt: string): {
  text: string;
  className: string;
} {
  const dueStr = toDateInputValue(dueAt);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dueDate = new Date(dueStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const days = Math.round(
    (dueDate.getTime() - today.getTime()) / 86400000
  );

  if (days < 0)
    return {
      text: `${Math.abs(days)}d overdue`,
      className: "text-red-600 font-semibold",
    };
  if (days === 0)
    return { text: "Due today", className: "text-amber-600 font-medium" };
  if (days === 1) return { text: "Tomorrow", className: "text-blue-600" };
  if (days <= 7) {
    const dayName = dueDate.toLocaleDateString("en-US", { weekday: "short" });
    return { text: `Due ${dayName}`, className: "text-foreground" };
  }
  return {
    text: `Due ${formatDateDisplay(dueAt)}`,
    className: "text-muted-foreground",
  };
}
