import { cookies } from "next/headers";

export const AUTH_COOKIE = "kelli_gate";

export function getSitePassword(): string {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    throw new Error("SITE_PASSWORD is not set");
  }
  return password;
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(AUTH_COOKIE)?.value;
  return value === getSitePassword();
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
