/**
 * Server-side route protection.
 *
 * The HttpOnly session cookie lives in the browser and reaches the Vercel
 * proxy. We can't decode JWTs here (the JWT secret is server-side), but we
 * can check for *presence* of the cookie and bounce anonymous users away
 * from protected routes. The protected pages still call /me on mount to
 * confirm the session is real — this middleware is the first line of defense,
 * not the only one.
 *
 * Protected surfaces (workspace only — top-level /brands, /creators, /clippers
 * are public marketing pages):
 *   /account           — every logged-in user
 *   /brands/dashboard  — brand role only
 *   /brands/campaigns  — brand role only
 *   /clippers/*        — clipper role only (workspace only)
 *   /creators/dashboard — creator role only
 *   /onboarding/*      — every logged-in user
 *
 * Why cookie-presence, not role-aware? The role lives inside the encrypted
 * JWT; we don't have the key in middleware. So we allow any logged-in user
 * to land on a role-specific page, then the page-level useAuth() does the
 * role gate. Belt + suspenders.
 */
import { NextResponse, type NextRequest } from "next/server";

// Workspace routes that REQUIRE auth. Note: /brands, /creators, /clippers
// at the TOP level are public marketing pages — only the workspace subpaths
// (dashboard, campaigns, etc.) are protected.
const PROTECTED_PREFIXES = [
  "/account",
  "/brands/dashboard",
  "/brands/campaigns",
  "/creators/dashboard",
  "/clippers/dashboard",
  "/clippers/clips",
  "/clippers/campaigns",
  "/onboarding",
];

// Public auth pages — logged-in users get bounced away from these
const AUTH_PAGES = ["/login", "/signup"];

const COOKIE_NAMES = [
  "relativ_session",       // canonical name (current)
  "relativ_access_token",  // legacy / dev
  "session",               // alt dev name
];

function hasSessionCookie(req: NextRequest): boolean {
  for (const name of COOKIE_NAMES) {
    if (req.cookies.get(name)?.value) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthed = hasSessionCookie(req);

  // 1. Authed users hitting /login or /signup → send to /account
  if (isAuthed && AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  // 2. Anonymous users hitting protected routes → /signup (with a hint)
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!isAuthed && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Skip middleware on static assets, API routes, and the proxy itself.
 * The matcher also runs for the proxy route — but it returns
 * NextResponse.next() for /api/* anyway, so the cost is a cookie check.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static (build assets)
     *  - _next/image (image optimizer)
     *  - favicon, robots, sitemap, manifest
     *  - public files in /public
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.webp$|.*\\.ico$|api/).*)",
  ],
};
