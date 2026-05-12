const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = [
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
  "smid"
];

export function canonicalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (
      TRACKING_PARAM_NAMES.includes(key.toLowerCase()) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))
    ) {
      url.searchParams.delete(key);
    }
  }

  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

export function stableArticleId(source: string, url: string): string {
  const canonical = canonicalizeUrl(url);
  const input = `${source}:${canonical}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(hash >>> 0).toString(36)}`;
}

export function isHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
