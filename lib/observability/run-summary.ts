import type { AuditReport, CorpusBundle, Digest, PublishedDigestEnvelope } from "@/lib/schema";
import { flattenCorpus } from "@/lib/schema";
import { getStorage } from "@/lib/storage";
import { summarizeRun } from "@/lib/observability/token-log";

export type StageDurations = {
  ingest?: number;
  preflight?: number;
  synthesis?: number;
  audit?: number;
  publish?: number;
  total?: number;
};

export type SourceHealth = {
  source: string;
  pool: string;
  status: "ok" | "empty" | "error" | "disabled";
  items_fetched: number;
  items_in_window: number;
  issue?: string;
  last_successful_fetch_at?: string;
};

export type PipelineRunSummary = {
  date: string;
  duration_total_ms: number;
  duration_by_stage: StageDurations;
  llm_cost_usd: number;
  llm_calls: number;
  ingestion: {
    curated: { sources_attempted: number; sources_succeeded: number; items_fetched: number; items_in_24h: number };
    global: { sources_attempted: number; sources_succeeded: number; items_fetched: number; items_in_24h: number };
    discovery: { sources_attempted: number; sources_succeeded: number; items_fetched: number; items_in_24h: number };
  };
  source_health: SourceHealth[];
  synthesis: {
    triage_counts: { read_in_full: number; worth_a_glance: number; skip: number };
    themes: number;
    lexicon: number;
    global: number;
    for_you: number;
    word_count: number;
  };
  audit: {
    preflight_fails: number;
    semantic_fails: number;
    warnings: number;
    items_removed: number;
    provider: string;
  };
  published_url?: string;
};

function poolSummary(pool: "curated" | "global" | "discovery", corpus: CorpusBundle, sourceHealth: SourceHealth[]) {
  const articles = corpus[pool];
  const poolSources = sourceHealth.filter((source) => source.pool === pool);
  return {
    sources_attempted: poolSources.length,
    sources_succeeded: poolSources.filter((source) => source.status === "ok").length,
    items_fetched: poolSources.reduce((sum, source) => sum + source.items_fetched, 0),
    items_in_24h: articles.length
  };
}

export async function saveRunSummary(input: {
  date: string;
  durations: StageDurations;
  corpus: CorpusBundle;
  sourceHealth: SourceHealth[];
  digest: Digest;
  audit: AuditReport;
  envelope?: PublishedDigestEnvelope;
}) {
  const llm = await summarizeRun(input.date);
  const failures = input.audit.verification_report.filter((issue) => issue.severity === "fail");
  const warnings = input.audit.verification_report.filter((issue) => issue.severity === "warn");
  const summary: PipelineRunSummary = {
    date: input.date,
    duration_total_ms: input.durations.total ?? 0,
    duration_by_stage: input.durations,
    llm_cost_usd: llm.llm_cost_usd,
    llm_calls: llm.llm_calls,
    ingestion: {
      curated: poolSummary("curated", input.corpus, input.sourceHealth),
      global: poolSummary("global", input.corpus, input.sourceHealth),
      discovery: poolSummary("discovery", input.corpus, input.sourceHealth)
    },
    source_health: input.sourceHealth,
    synthesis: {
      triage_counts: {
        read_in_full: input.digest.reading_queue.read_in_full.length,
        worth_a_glance: input.digest.reading_queue.worth_a_glance.length,
        skip: input.digest.reading_queue.skipped_count
      },
      themes: input.digest.themes.length,
      lexicon: input.digest.lexicon.length,
      global: input.digest.global.length,
      for_you: input.digest.for_you.length,
      word_count: input.digest.total_word_count
    },
    audit: {
      preflight_fails: 0,
      semantic_fails: failures.length,
      warnings: warnings.length,
      items_removed: failures.length,
      provider: input.audit.audit_provider
    },
    published_url: input.envelope
      ? `${process.env.SITE_URL?.replace(/\/+$/, "") ?? ""}/${input.envelope.date}`
      : undefined
  };

  await getStorage().saveRunArtifact(input.date, "summary.json", summary);
  return summary;
}

export async function getRunSummary(date: string): Promise<PipelineRunSummary | null> {
  return getStorage().getRunArtifact<PipelineRunSummary>(date, "summary.json");
}

export function sourceHealthFromCorpus(corpus: CorpusBundle): SourceHealth[] {
  const rows = new Map<string, SourceHealth>();
  for (const article of flattenCorpus(corpus)) {
    const key = `${article.source_pool}:${article.source}`;
    const existing =
      rows.get(key) ??
      ({
        source: article.source,
        pool: article.source_pool,
        status: "ok",
        items_fetched: 0,
        items_in_window: 0,
        last_successful_fetch_at: new Date().toISOString()
      } satisfies SourceHealth);
    existing.items_fetched += 1;
    existing.items_in_window += 1;
    rows.set(key, existing);
  }
  return [...rows.values()];
}
