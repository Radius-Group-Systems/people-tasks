-- Fix dates stored at midnight UTC to noon UTC
-- This prevents timezone-related day-shift display bugs.
-- A date-only value at midnight UTC shows as the previous day in Mountain Time (UTC-7).
-- Shifting to noon UTC ensures the correct calendar date in any timezone.

UPDATE action_items
SET due_at = due_at + INTERVAL '12 hours'
WHERE due_at IS NOT NULL
  AND EXTRACT(HOUR FROM due_at AT TIME ZONE 'UTC') = 0
  AND EXTRACT(MINUTE FROM due_at AT TIME ZONE 'UTC') = 0;

UPDATE action_items
SET snoozed_until = snoozed_until + INTERVAL '12 hours'
WHERE snoozed_until IS NOT NULL
  AND EXTRACT(HOUR FROM snoozed_until AT TIME ZONE 'UTC') = 0
  AND EXTRACT(MINUTE FROM snoozed_until AT TIME ZONE 'UTC') = 0;
