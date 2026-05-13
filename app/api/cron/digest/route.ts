import { NextResponse, type NextRequest } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { formatDateInET } from "@/lib/dates";
import { runDailyPipeline } from "@/lib/pipeline";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const RUNNING_PREFIX = "running:";
const FINISHED_PREFIX = "finished:";
const DEFAULT_RUN_LOCK_MS = 10 * 60 * 1000;

function parseRunningStartedAt(marker: string | null): number | null {
  if (!marker?.startsWith(RUNNING_PREFIX)) return null;
  const startedAt = Date.parse(marker.slice(RUNNING_PREFIX.length));
  return Number.isFinite(startedAt) ? startedAt : null;
}

export async function GET(req: NextRequest) {
  try {
    assertCronAuthorized(req);
    const date = req.nextUrl.searchParams.get("date") ?? formatDateInET();
    const force = req.nextUrl.searchParams.get("force") === "true";
    const marker = `digest:${date}`;
    const runningMarker = `digest-running:${date}`;
    const storage = getStorage();
    const existing = await storage.getMarker(marker);
    if (existing && !force) {
      return NextResponse.json({ ok: true, date, skipped: "already-ran", marker: existing });
    }

    const running = await storage.getMarker(runningMarker);
    const runningStartedAt = parseRunningStartedAt(running);
    const lockMs = Number(process.env.DIGEST_RUN_LOCK_MS ?? DEFAULT_RUN_LOCK_MS);
    if (runningStartedAt && Date.now() - runningStartedAt < lockMs) {
      return NextResponse.json({
        ok: true,
        date,
        skipped: "already-running",
        started_at: new Date(runningStartedAt).toISOString(),
        retry_after_seconds: Math.ceil((lockMs - (Date.now() - runningStartedAt)) / 1000)
      });
    }

    await storage.setMarker(runningMarker, `${RUNNING_PREFIX}${new Date().toISOString()}`);
    let envelope;
    try {
      envelope = await runDailyPipeline(date);
      await storage.setMarker(marker, envelope.published_at);
    } finally {
      await storage.setMarker(runningMarker, `${FINISHED_PREFIX}${new Date().toISOString()}`);
    }

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
