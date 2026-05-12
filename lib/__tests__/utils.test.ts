import { describe, expect, it } from "vitest";
import { isWithinETDate } from "../dates";
import { computeDigestWordCount, truncateChars, wordCount } from "../text";
import { canonicalizeUrl, stableArticleId } from "../urls";

describe("url utilities", () => {
  it("canonicalizes tracking parameters and hashes", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com/a/?utm_source=x&b=1#frag")).toBe(
      "https://example.com/a?b=1"
    );
  });

  it("creates stable article ids", () => {
    expect(stableArticleId("Source", "https://example.com/a")).toBe(
      stableArticleId("Source", "https://example.com/a?utm_source=newsletter")
    );
  });
});

describe("text utilities", () => {
  it("counts words and truncates without splitting mid-word when possible", () => {
    expect(wordCount("one two  three")).toBe(3);
    expect(truncateChars("one two three four", 12)).toContain("...");
  });

  it("computes digest word count while ignoring urls and metadata", () => {
    expect(
      computeDigestWordCount({
        text: "one two",
        url: "https://example.com/one-two",
        nested: { body: "three four five" }
      })
    ).toBe(5);
  });
});

describe("date utilities", () => {
  it("checks whether a timestamp is inside an ET digest day", () => {
    expect(isWithinETDate("2026-05-11T13:00:00.000Z", "2026-05-11")).toBe(true);
    expect(isWithinETDate("2026-05-12T05:00:00.000Z", "2026-05-11")).toBe(false);
  });
});
