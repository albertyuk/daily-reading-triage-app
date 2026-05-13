export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")} ...`;
}

export function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, Math.max(lastSpace, maxChars - 200)).trim()} ...`;
}

export function computeDigestWordCount(value: unknown): number {
  if (typeof value === "string") return wordCount(value);
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + computeDigestWordCount(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce((sum, [key, item]) => {
      if (
        key.startsWith("_") ||
        key === "url" ||
        key === "sources" ||
        key === "date" ||
        key === "total_word_count"
      ) {
        return sum;
      }
      return sum + computeDigestWordCount(item);
    }, 0);
  }
  return 0;
}
