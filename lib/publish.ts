import {
  type AuditReport,
  type ArticleDecision,
  type CorpusBundle,
  type PublishedDigestEnvelope,
  type RunLog,
  type RunStats
} from "@/lib/schema";
import { getStorage } from "@/lib/storage";
import { getSynthesisProviderLabel } from "@/lib/synthesize";

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
    china_count: corpus.china.length,
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
    synthesis_provider: getSynthesisProviderLabel(),
    audit_duration_ms: audit.audit_duration_ms,
    run_duration_ms: Date.now() - runStartedAt
  };
}

function buildArticleDecisionLog(corpus: CorpusBundle, audit: AuditReport): ArticleDecision[] {
  const digest = audit.cleaned_digest;
  const readInFull = new Map(digest.reading_queue.read_in_full.map((item) => [item.url, item]));
  const worthAGlance = new Map(digest.reading_queue.worth_a_glance.map((item) => [item.url, item]));
  const forYou = new Map(digest.for_you.map((item) => [item.url, item]));

  const usedBriefingSources = new Map<string, string>();
  for (const item of digest.global) {
    for (const source of item.sources) usedBriefingSources.set(source, `global: ${item.headline}`);
  }
  for (const item of digest.china) {
    for (const source of item.sources) usedBriefingSources.set(source, `china: ${item.headline}`);
  }

  const decisions: ArticleDecision[] = [];
  for (const article of [...corpus.curated, ...corpus.global, ...corpus.china, ...corpus.discovery]) {
    const full = readInFull.get(article.url);
    const glance = worthAGlance.get(article.url);
    const personal = forYou.get(article.url);
    const briefing = usedBriefingSources.get(article.url);

    let decision = "not_selected";
    let rationale = "Not selected for the public digest after ranking against the day's stronger matches.";

    if (full) {
      decision = "read_in_full";
      rationale = full.text;
    } else if (glance) {
      decision = "worth_a_glance";
      rationale = glance.text;
    } else if (personal) {
      decision = "for_you";
      rationale = personal.why_for_you;
    } else if (briefing) {
      decision = briefing;
      rationale = "Used as supporting source material for a synthesized briefing item.";
    } else if (article.source_pool === "curated") {
      decision = "skip";
      rationale = digest.reading_queue.skip_reason_summary;
    } else if (article.source_pool === "global" || article.source_pool === "china") {
      rationale = "Not among the highest-impact briefing clusters after cross-source ranking.";
    } else if (article.source_pool === "discovery") {
      rationale = "Did not clearly beat other discovery items on the reader's stated interests.";
    }

    decisions.push({
      article_id: article.id,
      title: article.title,
      source: article.source,
      url: article.url,
      pool: article.source_pool,
      decision,
      rationale
    });
  }

  return decisions;
}

function buildRunLog(corpus: CorpusBundle, audit: AuditReport): RunLog {
  const failures = audit.verification_report.filter((item) => item.severity === "fail");
  const warnings = audit.verification_report.filter((item) => item.severity === "warn");

  return {
    synthesis: [
      {
        stage: "synthesis",
        label: "Synthesis model",
        model: getSynthesisProviderLabel(),
        detail:
          "Claude generated the triage, briefing sections, lexicon, personalized discovery, and article-level selection decisions from the ingested corpus."
      },
      {
        stage: "synthesis",
        label: "Corpus size",
        detail: `${corpus.curated.length} curated, ${corpus.global.length} global, ${corpus.china.length} China, and ${corpus.discovery.length} discovery articles were considered.`
      }
    ],
    audit: [
      {
        stage: "audit",
        label: "Audit model",
        model: audit.audit_provider,
        detail: `${audit.audit_provider} verified source URLs, attributions, and factual claims. It returned ${failures.length} fail and ${warnings.length} warn issues.`
      },
      ...audit.verification_report.map((issue) => ({
        stage: "audit" as const,
        label: `${issue.severity.toUpperCase()} ${issue.section}`,
        detail: issue.issue
      }))
    ],
    article_decisions: buildArticleDecisionLog(corpus, audit)
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
    synthesis_provider: getSynthesisProviderLabel(),
    audit_provider: audit.audit_provider,
    audit_duration_ms: audit.audit_duration_ms,
    verification_report: audit.verification_report,
    run_log: buildRunLog(corpus, audit),
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
