import type { Digest, SourceArticle } from "../lib/schema";

export function fixtureCorpus(date = "2026-05-11"): SourceArticle[] {
  const base = {
    date,
    published_at: `${date}T12:00:00.000Z`,
    content:
      "The company reported revenue of $42 million and opened a new office in Hong Kong. The story was confirmed by executives and public filings.",
    word_count: 25
  };

  return [
    {
      ...base,
      id: "lenny-1",
      title: "Startup Distribution Notes",
      author: "Lenny Rachitsky",
      source: "Lenny's Newsletter",
      url: "https://example.com/lenny-distribution",
      source_pool: "curated" as const,
      source_type: "free_rss" as const
    },
    {
      ...base,
      id: "generalist-1",
      title: "Platform Strategy",
      author: "Mario Gabriele",
      source: "The Generalist",
      url: "https://example.com/platform-strategy",
      source_pool: "curated" as const,
      source_type: "free_rss" as const
    },
    ...Array.from({ length: 7 }, (_, index) => ({
      ...base,
      id: `global-${index}`,
      title: `Global Story ${index + 1}`,
      author: "Reuters",
      source: "Reuters Top News",
      url: `https://example.com/global-${index + 1}`,
      source_pool: "global" as const,
      source_type: "free_rss" as const
    })),
    {
      ...base,
      id: "discovery-1",
      title: "AI Video Workflow",
      author: "TechCrunch",
      source: "TechCrunch",
      url: "https://example.com/ai-video-workflow",
      source_pool: "discovery" as const,
      source_type: "free_rss" as const
    }
  ];
}

export function corruptedDraft(date = "2026-05-11"): Digest {
  return {
    date,
    reading_queue: {
      read_in_full: [
        {
          author: "Lenny Rachitsky",
          source: "Lenny's Newsletter",
          url: "https://example.com/not-in-corpus",
          tier: "read_in_full",
          text: "A useful orientation to startup distribution, but the URL is intentionally wrong.",
          estimated_read_minutes: 8
        }
      ],
      worth_a_glance: [
        {
          author: "Not The Author",
          source: "The Generalist",
          url: "https://example.com/platform-strategy",
          tier: "worth_a_glance",
          text: 'The piece says "this quotation does not exist in the source" and attributes it incorrectly.'
        }
      ],
      skipped_count: 0,
      skip_reason_summary: "Fixture has no skipped items."
    },
    themes: [
      {
        name: "Distribution pressure",
        synthesis: "Two curated pieces converge on distribution as a startup bottleneck.",
        underlying_pieces: [
          {
            author: "Lenny Rachitsky",
            source: "Lenny's Newsletter",
            url: "https://example.com/lenny-distribution"
          },
          {
            author: "Mario Gabriele",
            source: "The Generalist",
            url: "https://example.com/platform-strategy"
          }
        ]
      }
    ],
    lexicon: [],
    global: Array.from({ length: 5 }, (_, index) => ({
      headline: `Global Story ${index + 1}`,
      body:
        index === 0
          ? "Reuters reported that the company generated $420 million in revenue, an intentionally wrong figure."
          : "Reuters reported a global business story with broad market relevance and confirmed details.",
      sources: [`https://example.com/global-${index + 1}`]
    })),
    china: [],
    for_you: [
      {
        headline: "AI Video Workflow",
        body: "A discovery item connects AI tooling with creative production workflows.",
        why_for_you: "AI as a creative tool",
        url: "https://example.com/ai-video-workflow",
        source: "TechCrunch"
      }
    ],
    total_word_count: 240
  };
}
