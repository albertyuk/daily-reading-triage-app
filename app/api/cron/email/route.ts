import { NextResponse, type NextRequest } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { formatDateInET } from "@/lib/dates";
import { sendDigestEmail } from "@/lib/email";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    const date = req.nextUrl.searchParams.get("date") ?? formatDateInET();
    const marker = `email:${date}`;
    const storage = getStorage();
    const existing = await storage.getMarker(marker);
    if (existing) {
      return NextResponse.json({ ok: true, date, skipped: "already-sent", marker: existing });
    }

    const envelope = await storage.getDigest(date);
    if (!envelope) {
      return NextResponse.json({ ok: false, error: `No digest found for ${date}` }, { status: 404 });
    }

    await sendDigestEmail(envelope);
    const sentAt = new Date().toISOString();
    await storage.setMarker(marker, sentAt);
    return NextResponse.json({ ok: true, date, sent_at: sentAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown email cron error" },
      { status: 500 }
    );
  }
}
