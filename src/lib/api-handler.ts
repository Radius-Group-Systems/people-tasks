import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { TenantDb, tenantDb } from "@/lib/db";

export interface AuthContext {
  db: TenantDb;
  orgId: string;
  userId: string;
  role: string;
}

interface WithAuthOptions {
  requireAdmin?: boolean;
}

type RouteHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse | Response>;

export function withAuth(handler: RouteHandler, options?: WithAuthOptions) {
  return async (
    req: NextRequest,
    routeCtx?: { params: Promise<Record<string, string>> }
  ) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.orgId) {
      return NextResponse.json(
        { error: "No organization. Complete onboarding first." },
        { status: 403 }
      );
    }

    if (options?.requireAdmin && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const db = await tenantDb(session.user.orgId);

    try {
      const params = routeCtx?.params ? await routeCtx.params : undefined;
      return await handler(req, {
        db,
        orgId: session.user.orgId,
        userId: session.user.id,
        role: session.user.role,
      }, params);
    } finally {
      await db.release();
    }
  };
}
