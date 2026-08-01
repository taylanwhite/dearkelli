import { NextResponse } from "next/server";
import { AUTH_COOKIE, getSitePassword, timingSafeEqual } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string; next?: string };
  const password = body.password ?? "";

  try {
    const expected = getSitePassword();
    if (!timingSafeEqual(password, expected)) {
      return NextResponse.json({ error: "That isn't it." }, { status: 401 });
    }
  } catch {
    return NextResponse.json(
      { error: "The gate isn't set up yet." },
      { status: 500 },
    );
  }

  const nextPath =
    body.next && body.next.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : "/";

  const response = NextResponse.json({ ok: true, next: nextPath });
  response.cookies.set(AUTH_COOKIE, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
