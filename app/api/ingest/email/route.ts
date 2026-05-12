import { NextResponse, type NextRequest } from "next/server";
import { processInboundEmailEvent, verifyResendWebhook } from "@/lib/email-ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const event = await verifyResendWebhook(req);
    const article = await processInboundEmailEvent(event);
    return NextResponse.json({ ok: true, article_id: article?.id ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown inbound error" },
      { status: 400 }
    );
  }
}
