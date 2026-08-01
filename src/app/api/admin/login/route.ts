import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getAdminPassword,
  timingSafeEqual,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string; next?: string };
  const password = body.password ?? "";

  try {
    if (!timingSafeEqual(password, getAdminPassword())) {
      return NextResponse.json({ error: "That isn't it." }, { status: 401 });
    }
  } catch {
    return NextResponse.json(
      { error: "Admin password isn't configured." },
      { status: 500 },
    );
  }

  const nextPath =
    body.next && body.next.startsWith("/admin") && !body.next.startsWith("//")
      ? body.next
      : "/admin";

  const response = NextResponse.json({ ok: true, next: nextPath });
  response.cookies.set(ADMIN_COOKIE, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
