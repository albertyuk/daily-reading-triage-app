import {
  AuditReportSchema,
  type AuditReport,
  type Digest,
  type GlobalItem,
  type SourceArticle,
  type VerificationIssue
} from "@/lib/schema";
import { computeDigestWordCount, truncateWords } from "@/lib/text";

function normalizeId(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['"`“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function issueMatchesItem(
  issue: VerificationIssue,
  item: { headline?: string; url?: string; source?: string; term?: string; name?: string; text?: string }
): boolean {
  const target = normalizeId(issue.item_id);
  const issueText = normalizeId(issue.issue);
  const candidates = [item.headline, item.url, item.source, item.term, item.name, item.text]
    .map(normalizeId)
    .filter(Boolean);

  if (target) {
    return candidates.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate));
  }

  return candidates.some((candidate) => candidate.length > 16 && issueText.includes(candidate));
}

function sectionMatches(issue: VerificationIssue, section: string): boolean {
  const raw = issue.section.toLowerCase();
  return raw === section || raw.includes(section);
}

function sourceDerivedItem(article: SourceArticle): GlobalItem {
  const sourceText = truncateWords(article.excerpt || article.content || article.title, 65);
  return {
    headline: article.title,
    body: `${article.source} coverage focuses on ${article.title}. ${sourceText}`,
    sources: [article.url]
  };
}

function isLowValueBriefingArticle(article: SourceArticle): boolean {
  const text = `${article.title} ${article.excerpt ?? ""}`.toLowerCase();
  const lowValuePatterns = [
    /\bgroom\b/,
    /\bwedding night\b/,
    /\bbest friend\b/,
    /\bben affleck\b/,
    /\bmatt damon\b/,
    /\bcelebrity\b/,
    /\bmovie\b/,
    /\bthe rip\b/,
    /\bsports?\b/,
    /\bviral\b/,
    /\bodd\b/,
    /\bweird\b/,
    /\bkilled\b/,
    /\bmurder\b/,
    /\bsues?\b/,
    /\blawsuit\b/
  ];
  const highValuePatterns = [
    /\belection\b/,
    /\btrade\b/,
    /\btariff\b/,
    /\bcentral bank\b/,
    /\binflation\b/,
    /\bwar\b/,
    /\bceasefire\b/,
    /\bchina\b/,
    /\brussia\b/,
    /\biran\b/,
    /\bmarkets?\b/,
    /\bai\b/,
    /\bsemiconductor\b/,
    /\bclimate\b/,
    /\bpolicy\b/,
    /\bregulation\b/,
    /\bipo\b/,
    /\bantitrust\b/,
    /\bdoj\b/,
    /\bsec\b/,
    /\bftc\b/,
    /\bsupreme court\b/,
    /\bfederal\b/,
    /\bgovernment\b/,
    /\bregulator\b/
  ];

  return lowValuePatterns.some((pattern) => pattern.test(text)) && !highValuePatterns.some((pattern) => pattern.test(text));
}

function diversifyArticles(articles: SourceArticle[], limit: number): SourceArticle[] {
  const selected: SourceArticle[] = [];
  const counts = new Map<string, number>();

  for (const article of articles) {
    const count = counts.get(article.source) ?? 0;
    if (count >= 2) continue;
    selected.push(article);
    counts.set(article.source, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const article of articles) {
    if (selected.some((item) => item.url === article.url)) continue;
    selected.push(article);
    if (selected.length >= limit) break;
  }

  return selected;
}

function usedBriefingUrls(digest: Digest): Set<string> {
  return new Set(digest.global.flatMap((item) => item.sources));
}

function fillBriefingItems(
  items: GlobalItem[],
  corpus: SourceArticle[],
  minimum: number,
  maximum: number
): GlobalItem[] {
  if (items.length >= minimum) return items.slice(0, maximum);

  const used = usedBriefingUrls({
    date: "",
    reading_queue: {
      read_in_full: [],
      worth_a_glance: [],
      skipped_count: 0,
      skip_reason_summary: ""
    },
    themes: [],
    lexicon: [],
    global: items,
    for_you: [],
    _skip_log: [],
    total_word_count: 0
  });
  const candidates = corpus
    .filter((article) => !used.has(article.url))
    .filter((article) => !isLowValueBriefingArticle(article))
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  const additions = diversifyArticles(candidates, minimum - items.length).map(sourceDerivedItem);

  return [...items, ...additions].slice(0, maximum);
}

function normalizeDigestWordCount(digest: Digest): Digest {
  return {
    ...digest,
    total_word_count: computeDigestWordCount({
      reading_queue: digest.reading_queue,
      themes: digest.themes,
      lexicon: digest.lexicon,
      global: digest.global,
      for_you: digest.for_you
    })
  };
}

export function sanitizeAuditReportForPublication(
  audit: AuditReport,
  corpus: SourceArticle[]
): AuditReport {
  const failures = audit.verification_report.filter((issue) => issue.severity === "fail");
  if (failures.length === 0) return audit;

  const digest: Digest = structuredClone(audit.cleaned_digest);

  digest.global = digest.global.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "global") && issueMatchesItem(issue, item))
  );
  digest.for_you = digest.for_you.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "for_you") && issueMatchesItem(issue, item))
  );
  digest.lexicon = digest.lexicon.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "lexicon") && issueMatchesItem(issue, item))
  );
  digest.themes = digest.themes.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "theme") && issueMatchesItem(issue, item))
  );
  digest.reading_queue.read_in_full = digest.reading_queue.read_in_full.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "reading") && issueMatchesItem(issue, item))
  );
  digest.reading_queue.worth_a_glance = digest.reading_queue.worth_a_glance.filter(
    (item) => !failures.some((issue) => sectionMatches(issue, "reading") && issueMatchesItem(issue, item))
  );

  digest.global = fillBriefingItems(
    digest.global,
    corpus.filter((article) => article.source_pool === "global"),
    5,
    7
  );

  const convertedFailures: VerificationIssue[] = failures.map((issue) => ({
    section: "audit",
    item_id: issue.item_id ?? null,
    issue: `Removed audit-failed ${issue.section} item from the published digest: ${issue.issue}`,
    severity: "warn"
  }));

  const sanitized = {
    ...audit,
    cleaned_digest: normalizeDigestWordCount(digest),
    verification_report: [
      ...convertedFailures,
      ...audit.verification_report.filter((issue) => issue.severity === "warn")
    ]
  };

  return AuditReportSchema.parse(sanitized);
}
