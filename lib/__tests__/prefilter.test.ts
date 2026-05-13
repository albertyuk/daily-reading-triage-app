import { afterEach, describe, expect, it } from "vitest";
import { prefilterCorpusForSynthesis } from "../prefilter";
import { SourceArticleSchema, type CorpusBundle, type SourceArticle } from "../schema";

function article(
  overrides: Partial<SourceArticle> & Pick<SourceArticle, "title" | "source" | "url" | "source_pool">
): SourceArticle {
  return SourceArticleSchema.parse({
    id: overrides.url,
    date: "2026-05-11",
    title: overrides.title,
    author: "Author",
    source: overrides.source,
    url: overrides.url,
    published_at: overrides.published_at ?? "2026-05-11T13:00:00.000Z",
    content:
      overrides.content ??
      "A sufficiently detailed article about policy, markets, technology, and institutional change.",
    source_pool: overrides.source_pool,
    source_type: "free_rss",
    word_count: overrides.word_count ?? 120,
    excerpt: overrides.excerpt,
    raw: overrides.raw
  });
}

function corpus(overrides: Partial<CorpusBundle>): CorpusBundle {
  return {
    date: "2026-05-11",
    curated: [],
    global: [],
    discovery: [],
    ...overrides
  };
}

describe("prefilterCorpusForSynthesis", () => {
  afterEach(() => {
    delete process.env.MAX_SYNTHESIS_GLOBAL;
    delete process.env.MAX_PREFILTER_ARTICLE_CHARS;
  });

  it("preserves curated newsletters while filtering low-value global items", () => {
    process.env.MAX_SYNTHESIS_GLOBAL = "2";

    const curated = article({
      title: "A light newsletter housekeeping note",
      source: "Curated",
      url: "https://example.com/curated",
      source_pool: "curated",
      content: "Short and possibly low signal, but curated items still need explicit triage."
    });
    const useful = article({
      title: "Central bank policy shifts as inflation pressures markets",
      source: "Useful Wire",
      url: "https://example.com/useful",
      source_pool: "global"
    });
    const lowValue = article({
      title: "Michigan groom killed best friend on wedding night",
      source: "Odd Wire",
      url: "https://example.com/low-value",
      source_pool: "global",
      content: "A local crime story with narrow personal details and no broader lesson."
    });

    const result = prefilterCorpusForSynthesis(corpus({ curated: [curated], global: [lowValue, useful] }));

    expect(result.curated.map((item) => item.url)).toEqual([curated.url]);
    expect(result.global.map((item) => item.url)).toEqual([useful.url]);
  });

  it("truncates article bodies before model calls", () => {
    process.env.MAX_PREFILTER_ARTICLE_CHARS = "30";
    const useful = article({
      title: "AI regulation changes platform strategy",
      source: "Useful Wire",
      url: "https://example.com/useful",
      source_pool: "global",
      content: "AI regulation changes platform strategy across markets and startups."
    });

    const result = prefilterCorpusForSynthesis(corpus({ global: [useful] }));

    expect(result.global[0].content.length).toBeLessThanOrEqual(33);
    expect(result.global[0].raw).toBeUndefined();
  });
});
