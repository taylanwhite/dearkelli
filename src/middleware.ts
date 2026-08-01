import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kelli_gate";
const ADMIN_COOKIE = "kelli_admin";

const PUBLIC_PREFIXES = [
  "/send",
  "/gather",
  "/login",
  "/admin/login",
  "/api/blob",
  "/api/media",
  "/api/auth",
  "/api/contributor",
  "/api/gather",
  "/api/admin/login",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Admin routes: separate password from her site gate
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (
      pathname === "/admin/login" ||
      pathname.startsWith("/api/admin/login")
    ) {
      return NextResponse.next();
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      if (process.env.NODE_ENV === "development") {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    if (request.cookies.get(ADMIN_COOKIE)?.value === adminPassword) {
      return NextResponse.next();
    }

    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.cookies.get(AUTH_COOKIE)?.value === password) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
