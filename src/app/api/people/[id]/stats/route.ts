import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (req, { db }, params) => {
  const id = params!.id;

  const stats = await db.getOne<{
    total_assigned: number;
    completed: number;
    open: number;
    overdue: number;
    avg_days_to_complete: number | null;
    completion_rate: number;
  }>(`
    SELECT
      COUNT(*)::int AS total_assigned,
      COUNT(*) FILTER (WHERE status = 'done')::int AS completed,
      COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS open,
      COUNT(*) FILTER (WHERE status = 'open' AND due_at < NOW())::int AS overdue,
      ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400) FILTER (WHERE status = 'done'))::int AS avg_days_to_complete,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric * 100)::int
        ELSE 0
      END AS completion_rate
    FROM action_items
    WHERE person_id = $1 AND owner_type = 'them'
  `, [id]);

  return NextResponse.json(stats || {
    total_assigned: 0, completed: 0, open: 0, overdue: 0,
    avg_days_to_complete: null, completion_rate: 0,
  });
});
