import {
  type AuditReport,
  type CorpusBundle,
  type PublishedDigestEnvelope,
  type RunStats
} from "@/lib/schema";
import { getStorage } from "@/lib/storage";

export function buildRunStats(
  date: string,
  corpus: CorpusBundle,
  audit: AuditReport,
  runStartedAt: number
): RunStats {
  const digest = audit.cleaned_digest;
  const failures = audit.verification_report.filter((item) => item.severity === "fail");
  const warnings = audit.verification_report.filter((item) => item.severity === "warn");

  return {
    date,
    curated_count: corpus.curated.length,
    global_count: corpus.global.length,
    discovery_count: corpus.discovery.length,
    read_in_full_count: digest.reading_queue.read_in_full.length,
    worth_a_glance_count: digest.reading_queue.worth_a_glance.length,
    skipped_count: digest.reading_queue.skipped_count,
    theme_count: digest.themes.length,
    lexicon_count: digest.lexicon.length,
    for_you_count: digest.for_you.length,
    word_count: digest.total_word_count,
    audit_fail_count: failures.length,
    audit_warn_count: warnings.length,
    audit_provider: audit.audit_provider,
    audit_duration_ms: audit.audit_duration_ms,
    run_duration_ms: Date.now() - runStartedAt
  };
}

export async function publish(
  date: string,
  audit: AuditReport,
  corpus: CorpusBundle,
  runStartedAt: number
): Promise<PublishedDigestEnvelope> {
  const envelope: PublishedDigestEnvelope = {
    date,
    digest: audit.cleaned_digest,
    audit_provider: audit.audit_provider,
    audit_duration_ms: audit.audit_duration_ms,
    verification_report: audit.verification_report,
    stats: buildRunStats(date, corpus, audit, runStartedAt),
    published_at: new Date().toISOString()
  };

  const storage = getStorage();
  await storage.saveDigest(date, envelope);
  await storage.appendLexicon(audit.cleaned_digest.lexicon);
  return envelope;
}

export function getTopHeadline(envelope: PublishedDigestEnvelope): string {
  const digest = envelope.digest;
  return (
    digest.global[0]?.headline ??
    digest.reading_queue.read_in_full[0]?.source ??
    digest.reading_queue.worth_a_glance[0]?.source ??
    "Daily Briefing"
  );
}
