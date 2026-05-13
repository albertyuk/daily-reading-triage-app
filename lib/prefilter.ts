import type { CorpusBundle, SourceArticle } from "@/lib/schema";
import { truncateChars } from "@/lib/text";

const LOW_VALUE_PATTERNS = [
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

const HIGH_VALUE_PATTERNS = [
  /\belection\b/,
  /\btrade\b/,
  /\btariff\b/,
  /\bcentral bank\b/,
  /\binflation\b/,
  /\brates?\b/,
  /\bwar\b/,
  /\bceasefire\b/,
  /\bchina\b/,
  /\brussia\b/,
  /\biran\b/,
  /\bindia\b/,
  /\beurope\b/,
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
  /\bregulator\b/,
  /\bmigration\b/,
  /\benergy\b/,
  /\bhealth\b/,
  /\bpublic health\b/,
  /\bplatform\b/,
  /\bstartup\b/,
  /\bventure\b/,
  /\bhong kong\b/,
  /\bhk\b/,
  /\bhardware\b/,
  /\bcamera\b/,
  /\bvideo\b/,
  /\bcreative\b/
];

const INTEREST_PATTERNS = [
  /\bstartup\b/,
  /\byc\b/,
  /\bventure\b/,
  /\bfundraising\b/,
  /\bai\b/,
  /\bagent\b/,
  /\bvideo\b/,
  /\bfilm\b/,
  /\bcamera\b/,
  /\bcreative\b/,
  /\bmarketing\b/,
  /\bbrand\b/,
  /\bequity\b/,
  /\bmarkets?\b/,
  /\bhong kong\b/,
  /\bchina\b/,
  /\bhardware\b/,
  /\bsemiconductor\b/,
  /\bphotography\b/,
  /\bliterature\b/
];

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function articleText(article: SourceArticle): string {
  return `${article.title} ${article.excerpt ?? ""} ${article.content.slice(0, 1200)}`.toLowerCase();
}

function patternScore(text: string, patterns: RegExp[], weight: number): number {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? weight : 0), 0);
}

function scoreArticle(article: SourceArticle): number {
  const text = articleText(article);
  let score = 0;
  score += patternScore(text, HIGH_VALUE_PATTERNS, 6);
  score += patternScore(text, INTEREST_PATTERNS, 5);
  score -= patternScore(text, LOW_VALUE_PATTERNS, 12);
  score += Math.min(article.word_count / 300, 6);

  if (article.source_pool === "curated") score += 25;
  if (article.source_pool === "china" && /\btech|ai|business|market|ipo|policy|platform\b/i.test(text)) score += 10;
  if (article.source_pool === "discovery") score += patternScore(text, INTEREST_PATTERNS, 3);

  return score;
}

function isLowValue(article: SourceArticle): boolean {
  const text = articleText(article);
  return (
    LOW_VALUE_PATTERNS.some((pattern) => pattern.test(text)) &&
    !HIGH_VALUE_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function diversify(articles: SourceArticle[], limit: number, maxPerSource: number): SourceArticle[] {
  const selected: SourceArticle[] = [];
  const counts = new Map<string, number>();

  for (const article of articles) {
    const count = counts.get(article.source) ?? 0;
    if (count >= maxPerSource) continue;
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

function truncateArticle(article: SourceArticle): SourceArticle {
  const maxChars = envNumber("MAX_PREFILTER_ARTICLE_CHARS", 3500);
  return {
    ...article,
    content: truncateChars(article.content, maxChars),
    raw: undefined
  };
}

function selectArticles(articles: SourceArticle[], limit: number, maxPerSource: number): SourceArticle[] {
  const eligible = articles.filter((article) => !isLowValue(article));
  const ranked = [...(eligible.length > 0 ? eligible : articles)]
    .sort((a, b) => scoreArticle(b) - scoreArticle(a) || b.published_at.localeCompare(a.published_at));

  return diversify(ranked, limit, maxPerSource).map(truncateArticle);
}

export function prefilterCorpusForSynthesis(corpus: CorpusBundle): CorpusBundle {
  const curatedLimit = envNumber("MAX_SYNTHESIS_CURATED", 20);

  if (process.env.PREFILTER_ENABLED === "false") {
    return {
      date: corpus.date,
      curated: corpus.curated.map(truncateArticle),
      global: corpus.global.map(truncateArticle),
      discovery: corpus.discovery.map(truncateArticle),
      china: corpus.china.map(truncateArticle)
    };
  }

  return {
    date: corpus.date,
    curated: corpus.curated.slice(0, curatedLimit).map(truncateArticle),
    global: selectArticles(corpus.global, envNumber("MAX_SYNTHESIS_GLOBAL", 24), 3),
    discovery: selectArticles(corpus.discovery, envNumber("MAX_SYNTHESIS_DISCOVERY", 18), 3),
    china: selectArticles(corpus.china, envNumber("MAX_SYNTHESIS_CHINA", 18), 3)
  };
}
