import { timingSafeEqual } from "@/lib/auth";

export function getGatherToken(): string {
  const token = process.env.GATHER_TOKEN;
  if (!token) {
    throw new Error("GATHER_TOKEN is not set");
  }
  return token;
}

export function isValidGatherToken(token: string): boolean {
  try {
    return timingSafeEqual(token, getGatherToken());
  } catch {
    return false;
  }
}

export function makeInviteToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64url")
    .replace(/=+$/, "");
}
