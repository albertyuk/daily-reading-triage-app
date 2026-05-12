import type { NextRequest } from "next/server";

export function assertCronAuthorized(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRON_SECRET is not configured");
    }
    return;
  }

  const header = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  if (header === `Bearer ${secret}` || querySecret === secret) return;

  throw new Error("Unauthorized cron request");
}
