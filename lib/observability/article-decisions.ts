import type { AuditReport, Digest, SourceArticle, SourcePool, VerificationIssue } from "@/lib/schema";
import { getStorage } from "@/lib/storage";

export type ArticleDecision = {
  article_url: string;
  article_title: string;
  source_name: string;
  source_pool: SourcePool;
  published_at: string;
  ingested_at: string;
  word_count: number;
  synthesis_decision:
    | "read_in_full"
    | "worth_a_glance"
    | "skip"
    | "global_briefing"
    | "for_you"
    | "lexicon_only"
    | "not_selected";
  synthesis_reasoning: string;
  audit_outcome?: "kept" | "removed_fail" | "kept_with_warning";
  audit_issues?: string[];
};

function issueForUrl(url: string, issues: VerificationIssue[]): VerificationIssue[] {
  return issues.filter((issue) => issue.issue.includes(url) || issue.item_id === url);
}

function auditOutcome(url: string, audit: AuditReport): Pick<ArticleDecision, "audit_outcome" | "audit_issues"> {
  const issues = issueForUrl(url, audit.verification_report);
  if (issues.length === 0) return { audit_outcome: "kept", audit_issues: [] };
  if (issues.some((issue) => issue.severity === "fail")) {
    return { audit_outcome: "removed_fail", audit_issues: issues.map((issue) => issue.issue) };
  }
  return { audit_outcome: "kept_with_warning", audit_issues: issues.map((issue) => issue.issue) };
}

export function buildArticleDecisions(
  corpus: SourceArticle[],
  draft: Digest,
  audit: AuditReport,
  ingestedAt = new Date().toISOString()
): ArticleDecision[] {
  const decisions = new Map<string, ArticleDecision>();
  for (const article of corpus) {
    decisions.set(article.url, {
      article_url: article.url,
      article_title: article.title,
      source_name: article.source,
      source_pool: article.source_pool,
      published_at: article.published_at,
      ingested_at: ingestedAt,
      word_count: article.word_count,
      synthesis_decision: "not_selected",
      synthesis_reasoning: "Not selected by the prefilter or final synthesis ranking.",
      ...auditOutcome(article.url, audit)
    });
  }

  for (const item of draft.reading_queue.read_in_full) {
    const decision = decisions.get(item.url);
    if (decision) {
      decision.synthesis_decision = "read_in_full";
      decision.synthesis_reasoning = item._reasoning ?? item.text;
    }
  }

  for (const item of draft.reading_queue.worth_a_glance) {
    const decision = decisions.get(item.url);
    if (decision) {
      decision.synthesis_decision = "worth_a_glance";
      decision.synthesis_reasoning = item._reasoning ?? item.text;
    }
  }

  for (const item of draft.global) {
    for (const url of item.sources) {
      const decision = decisions.get(url);
      if (decision) {
        decision.synthesis_decision = "global_briefing";
        decision.synthesis_reasoning = item._reasoning ?? `Used in global briefing item: ${item.headline}`;
      }
    }
  }

  for (const item of draft.for_you) {
    const decision = decisions.get(item.url);
    if (decision) {
      decision.synthesis_decision = "for_you";
      decision.synthesis_reasoning = item._reasoning ?? item.why_for_you;
    }
  }

  for (const entry of draft.lexicon) {
    const decision = decisions.get(entry.url);
    if (decision && decision.synthesis_decision === "not_selected") {
      decision.synthesis_decision = "lexicon_only";
      decision.synthesis_reasoning = entry._reasoning ?? entry.definition;
    }
  }

  for (const skipped of draft._skip_log ?? []) {
    const decision = decisions.get(skipped.article_url);
    if (decision && decision.synthesis_decision === "not_selected") {
      decision.synthesis_decision = "skip";
      decision.synthesis_reasoning = skipped.reason;
    }
  }

  return [...decisions.values()].sort(
    (a, b) => a.source_pool.localeCompare(b.source_pool) || a.source_name.localeCompare(b.source_name)
  );
}

export async function saveArticleDecisions(date: string, decisions: ArticleDecision[]) {
  await getStorage().saveRunArtifact(date, "article-decisions.json", decisions);
}

export async function getArticleDecisions(date: string): Promise<ArticleDecision[]> {
  return (await getStorage().getRunArtifact<ArticleDecision[]>(date, "article-decisions.json")) ?? [];
}
