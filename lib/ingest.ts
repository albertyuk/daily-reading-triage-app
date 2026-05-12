import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import Parser from "rss-parser";
import { getStorage } from "@/lib/storage";
import { allSources, sourcePools, type SourceConfig } from "@/lib/sources";
import { getETDateWindow, isWithinETDate } from "@/lib/dates";
import { SourceArticleSchema, type CorpusBundle, type SourceArticle, type SourcePool } from "@/lib/schema";
import { wordCount } from "@/lib/text";
import { canonicalizeUrl, isHttpUrl, stableArticleId } from "@/lib/urls";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "user-agent": "DailyReadingTriage/0.1 (+https://example.com)"
  }
});

type RssItem = Parser.Item & {
  creator?: string;
  "dc:creator"?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  isoDate?: string;
};

export type FeedCheckResult = {
  source: string;
  pool: SourcePool;
  rss: string | null;
  ok: boolean;
  disabled: boolean;
  item_count?: number;
  issue?: string;
};

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "DailyReadingTriage/0.1 (+https://example.com)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractReadableText(url: string, fallback: string): Promise<string> {
  try {
    const html = await fetchText(url);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const content = article?.textContent ? cleanText(article.textContent) : "";
    if (content.length > 400) return content;
  } catch (error) {
    console.warn(`Readability extraction failed for ${url}`, error);
  }

  return cleanText(fallback);
}

function getItemAuthor(item: RssItem, source: SourceConfig): string {
  const author = item.creator ?? item["dc:creator"] ?? item.author ?? "";
  return cleanText(author) || source.name;
}

function getItemDate(item: RssItem): string | null {
  const value = item.isoDate ?? item.pubDate;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function articleFromRssItem(item: RssItem, source: SourceConfig, date: string): Promise<SourceArticle | null> {
  const url = item.link ?? item.guid;
  if (!isHttpUrl(url)) return null;

  const publishedAt = getItemDate(item);
  if (!publishedAt || !isWithinETDate(publishedAt, date)) return null;

  const fallbackBody = cleanText(
    [item.contentSnippet, item.content, item.summary].filter(Boolean).join("\n\n")
  );
  const content = await extractReadableText(url, fallbackBody);
  if (content.length < 100) return null;

  const canonical = canonicalizeUrl(url);
  const title = cleanText(item.title ?? "Untitled");
  const article = {
    id: stableArticleId(source.name, canonical),
    date,
    title,
    author: getItemAuthor(item, source),
    source: source.name,
    url: canonical,
    published_at: publishedAt,
    content,
    excerpt: fallbackBody ? fallbackBody.slice(0, 500) : undefined,
    source_pool: source.pool,
    source_type: source.type,
    word_count: wordCount(content),
    raw: {
      guid: item.guid,
      categories: item.categories
    }
  };

  return SourceArticleSchema.parse(article);
}

async function ingestRssSource(source: SourceConfig, date: string): Promise<SourceArticle[]> {
  if (!source.rss || source.disabled) return [];
  const feed = await parser.parseURL(source.rss);
  const articles = await Promise.all(
    (feed.items as RssItem[]).map((item) => articleFromRssItem(item, source, date))
  );
  return articles.filter((article): article is SourceArticle => Boolean(article));
}

function scrapePitchbookLinks(html: string): Array<{ title: string; url: string }> {
  const dom = new JSDOM(html, { url: "https://pitchbook.com/news" });
  const document = dom.window.document;
  const links = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const title = cleanText(anchor.textContent ?? "");
      const href = anchor.getAttribute("href");
      if (!href || title.length < 12) return null;
      const url = new URL(href, "https://pitchbook.com").toString();
      if (!url.startsWith("https://pitchbook.com/news")) return null;
      return { title, url };
    })
    .filter((item): item is { title: string; url: string } => Boolean(item));

  const deduped = new Map<string, { title: string; url: string }>();
  for (const link of links) deduped.set(canonicalizeUrl(link.url), link);
  return [...deduped.values()].slice(0, 15);
}

function scrapeApLinks(html: string): Array<{ title: string; url: string }> {
  const dom = new JSDOM(html, { url: "https://apnews.com/hub/ap-top-news" });
  const document = dom.window.document;
  const links = [...document.querySelectorAll("a")]
    .map((anchor) => {
      const title = cleanText(anchor.textContent ?? "");
      const href = anchor.getAttribute("href");
      if (!href || title.length < 20) return null;
      const url = new URL(href, "https://apnews.com").toString();
      if (!url.startsWith("https://apnews.com/article/")) return null;
      return { title, url };
    })
    .filter((item): item is { title: string; url: string } => Boolean(item));

  const deduped = new Map<string, { title: string; url: string }>();
  for (const link of links) deduped.set(canonicalizeUrl(link.url), link);
  return [...deduped.values()].slice(0, 20);
}

async function ingestPitchbook(date: string, source: SourceConfig): Promise<SourceArticle[]> {
  const html = await fetchText("https://pitchbook.com/news");
  const links = scrapePitchbookLinks(html);
  const { start, end } = getETDateWindow(date);
  const publishedAt = new Date(Math.max(start.getTime(), Math.min(Date.now(), end.getTime() - 1))).toISOString();

  const articles = await Promise.all(
    links.map(async (link) => {
      const content = await extractReadableText(link.url, link.title);
      if (content.length < 100) return null;
      const canonical = canonicalizeUrl(link.url);
      return SourceArticleSchema.parse({
        id: stableArticleId(source.name, canonical),
        date,
        title: link.title,
        author: source.name,
        source: source.name,
        url: canonical,
        published_at: publishedAt,
        content,
        excerpt: content.slice(0, 500),
        source_pool: source.pool,
        source_type: "scrape",
        word_count: wordCount(content)
      });
    })
  );

  return articles.filter((article): article is SourceArticle => Boolean(article));
}

async function ingestApTopNews(date: string, source: SourceConfig): Promise<SourceArticle[]> {
  const html = await fetchText("https://apnews.com/hub/ap-top-news");
  const links = scrapeApLinks(html);
  const { start, end } = getETDateWindow(date);
  const publishedAt = new Date(Math.max(start.getTime(), Math.min(Date.now(), end.getTime() - 1))).toISOString();

  const articles = await Promise.all(
    links.map(async (link) => {
      const content = await extractReadableText(link.url, link.title);
      if (content.length < 100) return null;
      const canonical = canonicalizeUrl(link.url);
      return SourceArticleSchema.parse({
        id: stableArticleId(source.name, canonical),
        date,
        title: link.title,
        author: "Associated Press",
        source: source.name,
        url: canonical,
        published_at: publishedAt,
        content,
        excerpt: content.slice(0, 500),
        source_pool: source.pool,
        source_type: "scrape",
        word_count: wordCount(content)
      });
    })
  );

  return articles.filter((article): article is SourceArticle => Boolean(article));
}

async function ingestSource(source: SourceConfig, date: string): Promise<SourceArticle[]> {
  try {
    if (source.adapter === "ap_scrape") {
      return ingestApTopNews(date, source);
    }
    if (source.adapter === "pitchbook_scrape") {
      return ingestPitchbook(date, source);
    }
    return ingestRssSource(source, date);
  } catch (error) {
    console.warn(`Skipping ${source.name}:`, error);
    return [];
  }
}

export function dedupeArticles(articles: SourceArticle[]): SourceArticle[] {
  const seen = new Set<string>();
  const deduped: SourceArticle[] = [];

  for (const article of articles) {
    const key = canonicalizeUrl(article.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(article);
  }

  return deduped.sort((a, b) => b.published_at.localeCompare(a.published_at));
}

async function ingestPool(pool: SourcePool, date: string): Promise<SourceArticle[]> {
  const settled = await Promise.allSettled(sourcePools[pool].map((source) => ingestSource(source, date)));
  const sourceArticles = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`Skipping ${sourcePools[pool][index].name}:`, result.reason);
    return [];
  });
  return dedupeArticles(sourceArticles);
}

export async function ingestAll(date: string): Promise<CorpusBundle> {
  const [curated, global, discovery] = await Promise.all([
    ingestPool("curated", date),
    ingestPool("global", date),
    ingestPool("discovery", date)
  ]);

  const corpus = { date, curated, global, discovery };
  await getStorage().saveRawCorpus(date, corpus);
  return corpus;
}

export async function validateSourceFeeds(): Promise<FeedCheckResult[]> {
  const checks = await Promise.all(
    allSources.map(async (source) => {
      if (source.disabled || (!source.rss && !source.adapter)) {
        return {
          source: source.name,
          pool: source.pool,
          rss: source.rss,
          ok: false,
          disabled: true,
          issue: "Source has no public feed and is expected via email forwarding."
        } satisfies FeedCheckResult;
      }

      try {
        if (source.adapter === "pitchbook_scrape") {
          const html = await fetchText("https://pitchbook.com/news");
          const links = scrapePitchbookLinks(html);
          return {
            source: source.name,
            pool: source.pool,
            rss: source.rss,
            ok: links.length > 0,
            disabled: links.length === 0,
            item_count: links.length,
            issue: links.length > 0 ? undefined : "PitchBook scrape produced no usable links."
          } satisfies FeedCheckResult;
        }

        if (source.adapter === "ap_scrape") {
          const html = await fetchText("https://apnews.com/hub/ap-top-news");
          const links = scrapeApLinks(html);
          return {
            source: source.name,
            pool: source.pool,
            rss: source.rss,
            ok: links.length > 0,
            disabled: links.length === 0,
            item_count: links.length,
            issue: links.length > 0 ? undefined : "AP scrape produced no usable links."
          } satisfies FeedCheckResult;
        }

        if (!source.rss) throw new Error("Missing RSS URL");
        const feed = await parser.parseURL(source.rss);
        return {
          source: source.name,
          pool: source.pool,
          rss: source.rss,
          ok: feed.items.length > 0,
          disabled: feed.items.length === 0,
          item_count: feed.items.length,
          issue: feed.items.length > 0 ? undefined : "Feed parsed but had no items."
        } satisfies FeedCheckResult;
      } catch (error) {
        return {
          source: source.name,
          pool: source.pool,
          rss: source.rss,
          ok: false,
          disabled: true,
          issue: error instanceof Error ? error.message : "Unknown feed error"
        } satisfies FeedCheckResult;
      }
    })
  );

  return checks.sort((a, b) => a.pool.localeCompare(b.pool) || a.source.localeCompare(b.source));
}
