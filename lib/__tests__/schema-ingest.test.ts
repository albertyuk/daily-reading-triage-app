import { afterEach, describe, expect, it, vi } from "vitest";
import { DigestSchema, SourceArticleSchema, type SourceArticle } from "../schema";
import { dedupeArticles, extractReadableText } from "../ingest";

function article(url: string): SourceArticle {
  return SourceArticleSchema.parse({
    id: url,
    date: "2026-05-11",
    title: "Title",
    author: "Author",
    source: "Source",
    url,
    published_at: "2026-05-11T13:00:00.000Z",
    content: "A sufficiently long article body for testing ingestion dedupe behavior.",
    source_pool: "curated",
    source_type: "free_rss",
    word_count: 10
  });
}

describe("schema", () => {
  it("rejects global sections with fewer than five items", () => {
    const result = DigestSchema.safeParse({
      date: "2026-05-11",
      reading_queue: {
        read_in_full: [],
        worth_a_glance: [],
        skipped_count: 0,
        skip_reason_summary: "None"
      },
      themes: [],
      lexicon: [],
      global: [],
      for_you: [],
      total_word_count: 0
    });

    expect(result.success).toBe(false);
  });
});

describe("ingest dedupe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes by canonical URL", () => {
    const deduped = dedupeArticles([
      article("https://example.com/a?utm_source=x"),
      article("https://example.com/a")
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("falls back to feed text when Readability fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: "Fixture failure",
        text: async () => ""
      }))
    );

    await expect(extractReadableText("https://example.com/a", "Fallback body")).resolves.toBe(
      "Fallback body"
    );
  });
});
