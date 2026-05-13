import { describe, expect, it } from "vitest";
import { checkCrossItemConsistency } from "../audit/cross-item-consistency";
import { DigestSchema, GlobalItemSchema, SourceArticleSchema, type SourceArticle } from "../schema";
import { clusterGlobalArticles } from "../synthesize/cluster";

function globalArticle(title: string, url: string, content = title): SourceArticle {
  return SourceArticleSchema.parse({
    id: url,
    date: "2026-05-13",
    title,
    author: "Reporter",
    source: "Global Source",
    url,
    published_at: "2026-05-13T13:00:00.000Z",
    content,
    source_pool: "global",
    source_type: "free_rss",
    word_count: 80
  });
}

describe("remediation safeguards", () => {
  it("rejects duplicate body sentences", () => {
    const repeated = "This sentence repeats with enough length to matter. This sentence repeats with enough length to matter.";
    expect(
      GlobalItemSchema.safeParse({
        headline: "Repeated",
        body: repeated,
        sources: ["https://example.com/a"]
      }).success
    ).toBe(false);
  });

  it("clusters multiple outlets covering the same story", () => {
    const clusters = clusterGlobalArticles([
      globalArticle("Trump and Xi open Beijing summit as trade tensions rise", "https://example.com/a"),
      globalArticle("Xi meets Trump in Beijing for trade summit", "https://example.com/b"),
      globalArticle("Central bank holds rates after inflation report", "https://example.com/c")
    ]);

    expect(clusters[0].member_articles.map((item) => item.url)).toContain("https://example.com/a");
    expect(clusters[0].member_articles.map((item) => item.url)).toContain("https://example.com/b");
  });

  it("flags cross-item temporal contradictions", () => {
    const digest = DigestSchema.parse({
      date: "2026-05-13",
      reading_queue: {
        read_in_full: [],
        worth_a_glance: [],
        skipped_count: 0,
        skip_reason_summary: "None"
      },
      themes: [],
      lexicon: [],
      global: [
        {
          headline: "Trump meets Xi",
          body: "[AP](https://example.com/a) says Trump is in China for the first time since 2017.",
          sources: ["https://example.com/a"]
        },
        {
          headline: "China prepares for Trump visit",
          body: "[BBC](https://example.com/b) describes Trump's previous China trip as nearly a decade ago.",
          sources: ["https://example.com/b"]
        },
        ...Array.from({ length: 3 }, (_, index) => ({
          headline: `Other global story ${index}`,
          body: `[Source](https://example.com/${index}) reports a separate institutional story.`,
          sources: [`https://example.com/${index}`]
        }))
      ],
      for_you: [],
      _skip_log: [],
      total_word_count: 120
    });

    expect(checkCrossItemConsistency(digest).some((issue) => issue.severity === "fail")).toBe(true);
  });
});
