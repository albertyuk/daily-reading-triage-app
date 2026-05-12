import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Digest, SourceArticle } from "../schema";

const validDigest: Digest = {
  date: "2026-05-11",
  reading_queue: {
    read_in_full: [],
    worth_a_glance: [],
    skipped_count: 0,
    skip_reason_summary: "Fixture"
  },
  themes: [],
  lexicon: [],
  global: Array.from({ length: 5 }, (_, index) => ({
    headline: `Headline ${index}`,
    body: "A verified global item with enough context.",
    sources: [`https://example.com/global-${index}`]
  })),
  for_you: [],
  total_word_count: 100
};

const corpus: SourceArticle[] = validDigest.global.map((item, index) => ({
  id: `global-${index}`,
  date: "2026-05-11",
  title: item.headline,
  author: "Reuters",
  source: "Reuters Top News",
  url: item.sources[0],
  published_at: "2026-05-11T13:00:00.000Z",
  content: item.body,
  source_pool: "global" as const,
  source_type: "free_rss" as const,
  word_count: 8
}));

const mocks = vi.hoisted(() => ({
  openai: vi.fn(),
  anthropic: vi.fn(),
  repair: vi.fn()
}));

vi.mock("../audit/providers/openai", () => ({
  auditWithOpenAIRaw: mocks.openai
}));

vi.mock("../audit/providers/anthropic", () => ({
  auditWithAnthropicRaw: mocks.anthropic,
  getAnthropicAuditModel: () => "claude-sonnet-4-20250514"
}));

vi.mock("../synthesize", () => ({
  repairDigestForAudit: mocks.repair
}));

describe("auditDigest", () => {
  beforeEach(() => {
    mocks.openai.mockReset();
    mocks.anthropic.mockReset();
    mocks.repair.mockReset();
  });

  it("falls back to Anthropic when OpenAI fails", async () => {
    mocks.openai.mockRejectedValueOnce(new Error("openai down"));
    mocks.anthropic.mockResolvedValueOnce({
      cleaned_digest: validDigest,
      verification_report: [],
      audit_provider: "anthropic/claude-sonnet-4-6",
      audit_duration_ms: 0
    });

    const { auditDigest } = await import("../audit");
    const report = await auditDigest(validDigest, corpus, "openai");

    expect(report.audit_provider).toBe("anthropic/claude-sonnet-4-20250514");
    expect(mocks.openai).toHaveBeenCalledTimes(1);
    expect(mocks.anthropic).toHaveBeenCalledTimes(1);
  });

  it("repairs once when cleaned_digest fails schema validation", async () => {
    mocks.openai
      .mockResolvedValueOnce({
        cleaned_digest: { ...validDigest, global: [] },
        verification_report: [
          {
            section: "global",
            issue: "Removed invalid fixture items.",
            severity: "fail"
          }
        ],
        audit_provider: "openai/gpt-5.5",
        audit_duration_ms: 0
      })
      .mockResolvedValueOnce({
        cleaned_digest: validDigest,
        verification_report: [],
        audit_provider: "openai/gpt-5.5",
        audit_duration_ms: 0
      });
    mocks.repair.mockResolvedValueOnce(validDigest);

    const { auditDigest } = await import("../audit");
    const report = await auditDigest(validDigest, corpus, "openai");

    expect(report.cleaned_digest.global).toHaveLength(5);
    expect(mocks.repair).toHaveBeenCalledTimes(1);
    expect(mocks.openai).toHaveBeenCalledTimes(2);
  });
});
