import { z } from "zod";
import { repairDigestForAudit } from "@/lib/synthesize";
import {
  AuditReportSchema,
  type AuditReport,
  type Digest,
  type SourceArticle
} from "@/lib/schema";
import { AuditSchemaError } from "./errors";
import { auditWithAnthropicRaw } from "./providers/anthropic";
import { auditWithOpenAIRaw } from "./providers/openai";

export type AuditProvider = "openai" | "anthropic";

function providerFromEnv(): AuditProvider {
  return process.env.AUDIT_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

function providerLabel(provider: AuditProvider): string {
  return provider === "openai" ? "openai/gpt-5.5" : "anthropic/claude-sonnet-4-6";
}

async function runAuditProvider(
  provider: AuditProvider,
  draft: Digest,
  corpus: SourceArticle[]
): Promise<unknown> {
  if (provider === "openai") return auditWithOpenAIRaw(draft, corpus);
  return auditWithAnthropicRaw(draft, corpus);
}

function finalizeAuditReport(raw: unknown, provider: AuditProvider, t0: number): AuditReport {
  const withTrace = {
    ...(raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}),
    audit_provider: providerLabel(provider),
    audit_duration_ms: Date.now() - t0
  };

  try {
    return AuditReportSchema.parse(withTrace);
  } catch (error) {
    throw new AuditSchemaError(
      error instanceof z.ZodError ? error.message : "Audit report failed schema validation",
      withTrace,
      providerLabel(provider)
    );
  }
}

async function auditOnce(
  draft: Digest,
  corpus: SourceArticle[],
  provider: AuditProvider,
  t0: number
): Promise<AuditReport> {
  const raw = await runAuditProvider(provider, draft, corpus);
  return finalizeAuditReport(raw, provider, t0);
}

async function auditWithRepairOnce(
  draft: Digest,
  corpus: SourceArticle[],
  provider: AuditProvider,
  t0: number,
  err: AuditSchemaError
): Promise<AuditReport> {
  const rawDigest =
    err.raw && typeof err.raw === "object" && "cleaned_digest" in err.raw
      ? (err.raw as { cleaned_digest: unknown }).cleaned_digest
      : draft;
  const repaired = await repairDigestForAudit(rawDigest, corpus, err.message);
  return auditOnce(repaired, corpus, provider, t0);
}

export async function auditDigest(
  draft: Digest,
  corpus: SourceArticle[],
  provider: AuditProvider = providerFromEnv()
): Promise<AuditReport> {
  const t0 = Date.now();

  try {
    return await auditOnce(draft, corpus, provider, t0);
  } catch (err) {
    if (err instanceof AuditSchemaError) {
      return auditWithRepairOnce(draft, corpus, provider, t0, err);
    }

    console.error(`Audit failed on ${provider}, attempting fallback`, err);
    const fallback: AuditProvider = provider === "openai" ? "anthropic" : "openai";
    try {
      return await auditOnce(draft, corpus, fallback, t0);
    } catch (fallbackErr) {
      if (fallbackErr instanceof AuditSchemaError) {
        return auditWithRepairOnce(draft, corpus, fallback, t0, fallbackErr);
      }
      throw fallbackErr;
    }
  }
}

export async function auditDigestWithBothProviders(
  draft: Digest,
  corpus: SourceArticle[]
): Promise<Record<AuditProvider, AuditReport>> {
  const [openai, anthropic] = await Promise.all([
    auditDigest(draft, corpus, "openai"),
    auditDigest(draft, corpus, "anthropic")
  ]);
  return { openai, anthropic };
}
