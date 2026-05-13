import type { SourceArticle } from "@/lib/schema";
import { truncateChars } from "@/lib/text";

export type StoryCluster = {
  id: string;
  primary_topic: string;
  member_articles: SourceArticle[];
};

const STOPWORDS = new Set([
  "about",
  "after",
  "against",
  "amid",
  "and",
  "are",
  "as",
  "at",
  "before",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "its",
  "new",
  "of",
  "on",
  "over",
  "says",
  "the",
  "to",
  "with"
]);

function tokens(article: SourceArticle): Set<string> {
  const text = `${article.title} ${truncateChars(article.content, 240)}`.toLowerCase();
  const values = text
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return new Set(values);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function clusterTopic(articles: SourceArticle[]): string {
  const sourceCount = new Map<string, number>();
  for (const article of articles) {
    for (const token of tokens(article)) {
      sourceCount.set(token, (sourceCount.get(token) ?? 0) + 1);
    }
  }
  const keywords = [...sourceCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([token]) => token);
  return keywords.length > 0 ? keywords.join(" ") : articles[0]?.title ?? "global story";
}

export function clusterGlobalArticles(articles: SourceArticle[]): StoryCluster[] {
  const sorted = [...articles].sort((a, b) => b.published_at.localeCompare(a.published_at));
  const articleTokens = new Map(sorted.map((article) => [article.url, tokens(article)]));
  const clusters: SourceArticle[][] = [];

  for (const article of sorted) {
    const currentTokens = articleTokens.get(article.url) ?? new Set<string>();
    let bestClusterIndex = -1;
    let bestScore = 0;

    clusters.forEach((cluster, index) => {
      const score = Math.max(
        ...cluster.map((member) => jaccard(currentTokens, articleTokens.get(member.url) ?? new Set<string>()))
      );
      if (score > bestScore) {
        bestScore = score;
        bestClusterIndex = index;
      }
    });

    if (bestClusterIndex >= 0 && bestScore >= 0.24) {
      clusters[bestClusterIndex].push(article);
    } else {
      clusters.push([article]);
    }
  }

  return clusters
    .map((memberArticles, index) => ({
      id: `global-cluster-${index + 1}`,
      primary_topic: clusterTopic(memberArticles),
      member_articles: memberArticles
    }))
    .sort(
      (a, b) =>
        b.member_articles.length - a.member_articles.length ||
        b.member_articles[0].published_at.localeCompare(a.member_articles[0].published_at)
    );
}
