export const runtime = "nodejs";

import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  const publicPaths = ["/login", "/register", "/api/auth", "/api/notifications/process"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return;
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // Redirect users without an org to onboarding (except the onboarding page itself)
  if (!req.auth.user.orgId && pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    return Response.redirect(new URL("/onboarding", req.url));
  }
});

export const config = {
  matcher: [
    // Match all routes except static files and _next
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
