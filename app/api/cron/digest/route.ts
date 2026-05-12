import { NextResponse, type NextRequest } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { formatDateInET } from "@/lib/dates";
import { runDailyPipeline } from "@/lib/pipeline";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    const date = req.nextUrl.searchParams.get("date") ?? formatDateInET();
    const force = req.nextUrl.searchParams.get("force") === "true";
    const marker = `digest:${date}`;
    const storage = getStorage();
    const existing = await storage.getMarker(marker);
    if (existing && !force) {
      return NextResponse.json({ ok: true, date, skipped: "already-ran", marker: existing });
    }

    const envelope = await runDailyPipeline(date);
    await storage.setMarker(marker, envelope.published_at);
    return NextResponse.json({
      ok: true,
      date,
      stats: envelope.stats,
      audit_failures: envelope.verification_report.filter((item) => item.severity === "fail"),
      audit_warnings: envelope.verification_report.filter((item) => item.severity === "warn")
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown cron error" },
      { status: 500 }
    );
  }
}
