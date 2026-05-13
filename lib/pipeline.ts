import { auditDigest } from "@/lib/audit";
import { sanitizeAuditReportForPublication } from "@/lib/audit/sanitize";
import { formatDateInET } from "@/lib/dates";
import { sendAuditWarningEmail, sendFailureEmail } from "@/lib/email";
import { flattenCorpus } from "@/lib/schema";
import { ingestAll } from "@/lib/ingest";
import { buildArticleDecisions, saveArticleDecisions } from "@/lib/observability/article-decisions";
import { saveRunSummary, sourceHealthFromCorpus, type SourceHealth, type StageDurations } from "@/lib/observability/run-summary";
import { prefilterCorpusForSynthesis } from "@/lib/prefilter";
import { publish } from "@/lib/publish";
import { getStorage } from "@/lib/storage";
import { synthesize } from "@/lib/synthesize";

export async function runDailyPipeline(date = formatDateInET()) {
  const t0 = Date.now();
  const durations: StageDurations = {};

  try {
    await getStorage().clearRunEntries(date, "llm-calls");

    const ingestStart = Date.now();
    const corpus = await ingestAll(date);
    durations.ingest = Date.now() - ingestStart;

    const preflightStart = Date.now();
    const synthesisCorpus = prefilterCorpusForSynthesis(corpus);
    const auditCorpus = flattenCorpus(synthesisCorpus);
    durations.preflight = Date.now() - preflightStart;

    const synthesisStart = Date.now();
    const draft = await synthesize(synthesisCorpus);
    durations.synthesis = Date.now() - synthesisStart;

    const auditStart = Date.now();
    const rawAudit = await auditDigest(draft, auditCorpus);
    const audit = sanitizeAuditReportForPublication(rawAudit, auditCorpus);
    durations.audit = Date.now() - auditStart;

    const failures = rawAudit.verification_report.filter((item) => item.severity === "fail");
    const warnings = audit.verification_report.filter((item) => item.severity === "warn");
    console.log(
      `Audit: ${failures.length} fails, ${warnings.length} warnings, ${audit.audit_duration_ms}ms via ${audit.audit_provider}`
    );

    if (failures.length > 0) {
      await sendAuditWarningEmail(date, failures);
    }

    await saveArticleDecisions(date, buildArticleDecisions(flattenCorpus(corpus), draft, rawAudit));

    const publishStart = Date.now();
    const envelope = await publish(date, audit, corpus, t0, synthesisCorpus);
    durations.publish = Date.now() - publishStart;
    durations.total = Date.now() - t0;

    const sourceHealth =
      (await getStorage().getRunArtifact<SourceHealth[]>(date, "source-health.json")) ??
      sourceHealthFromCorpus(corpus);

    await saveRunSummary({
      date,
      durations,
      corpus,
      sourceHealth,
      digest: audit.cleaned_digest,
      audit,
      envelope
    });

    return envelope;
  } catch (error) {
    await sendFailureEmail(date, error);
    throw error;
  }
}
