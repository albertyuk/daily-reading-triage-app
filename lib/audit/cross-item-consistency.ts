import type { Digest, VerificationIssue } from "@/lib/schema";

type ClaimItem = {
  section: string;
  id: string;
  text: string;
  entities: Set<string>;
  temporalClaims: string[];
  numbers: string[];
};

function entities(text: string): Set<string> {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  return new Set(matches.filter((value) => value.length > 3));
}

function temporalClaims(text: string): string[] {
  return [
    ...(text.match(/\bsince\s+\d{4}\b/gi) ?? []),
    ...(text.match(/\b(?:nearly|almost|about)\s+a\s+decade\s+ago\b/gi) ?? []),
    ...(text.match(/\blast\s+(?:visited|visit|trip)[^.]{0,40}\d{4}\b/gi) ?? [])
  ].map((claim) => claim.toLowerCase());
}

function numbers(text: string): string[] {
  return text.match(/\b\d+(?:\.\d+)?\s?(?:%|percent|million|billion|trillion|years?|months?)?\b/gi) ?? [];
}

function claimItems(digest: Digest): ClaimItem[] {
  return [
    ...digest.global.map((item) => ({
      section: "global",
      id: item.headline,
      text: `${item.headline}. ${item.body}`,
      entities: entities(`${item.headline}. ${item.body}`),
      temporalClaims: temporalClaims(`${item.headline}. ${item.body}`),
      numbers: numbers(`${item.headline}. ${item.body}`)
    })),
    ...digest.for_you.map((item) => ({
      section: "for_you",
      id: item.headline,
      text: `${item.headline}. ${item.body}`,
      entities: entities(`${item.headline}. ${item.body}`),
      temporalClaims: temporalClaims(`${item.headline}. ${item.body}`),
      numbers: numbers(`${item.headline}. ${item.body}`)
    }))
  ];
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function hasTemporalConflict(a: ClaimItem, b: ClaimItem): boolean {
  if (a.temporalClaims.length === 0 || b.temporalClaims.length === 0) return false;
  const combined = [...a.temporalClaims, ...b.temporalClaims].join(" ");
  return /\bsince\s+\d{4}\b/i.test(combined) && /\b(?:nearly|almost|about)\s+a\s+decade\s+ago\b/i.test(combined);
}

export function checkCrossItemConsistency(digest: Digest): VerificationIssue[] {
  const items = claimItems(digest);
  const issues: VerificationIssue[] = [];

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!intersects(a.entities, b.entities)) continue;

      if (hasTemporalConflict(a, b)) {
        issues.push({
          section: "cross_item_consistency",
          item_id: `${a.id} / ${b.id}`,
          issue: `Possible cross-item temporal contradiction between "${a.id}" and "${b.id}": one item uses ${a.temporalClaims.join(", ") || "a temporal claim"} while the other uses ${b.temporalClaims.join(", ") || "a temporal claim"}. Reconcile before publishing.`,
          severity: "fail"
        });
      }
    }
  }

  return issues;
}
