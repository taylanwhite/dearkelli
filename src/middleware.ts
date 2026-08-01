import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kelli_gate";

const PUBLIC_PREFIXES = [
  "/send",
  "/gather",
  "/login",
  "/api/blob",
  "/api/media",
  "/api/auth",
  "/api/contributor",
  "/api/gather",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }

  // Static assets & Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  if (!password) {
    // Fail open in local scaffold so pages can render without env;
    // production should always set SITE_PASSWORD.
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === password) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
