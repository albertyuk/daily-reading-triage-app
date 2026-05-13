const HOST_NAMES: Record<string, string> = {
  "apnews.com": "AP",
  "bbc.co.uk": "BBC",
  "bbc.com": "BBC",
  "theguardian.com": "The Guardian",
  "npr.org": "NPR",
  "aljazeera.com": "Al Jazeera",
  "dw.com": "DW",
  "france24.com": "France 24",
  "ft.com": "Financial Times",
  "techcrunch.com": "TechCrunch",
  "hnrss.org": "Hacker News",
  "sifted.eu": "Sifted",
  "pitchbook.com": "PitchBook",
  "importai.substack.com": "Import AI",
  "oneusefulthing.org": "One Useful Thing",
  "feeds.feedblitz.com": "Marginal Revolution",
  "thedailyupside.com": "The Daily Upside",
  "whatsonweibo.com": "What's on Weibo",
  "chinadaily.com.cn": "China Daily",
  "english.news.cn": "Xinhua",
  "technode.com": "TechNode",
  "pandaily.com": "Pandaily"
};

export function publicationFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return HOST_NAMES[host] ?? HOST_NAMES[host.split(".").slice(-2).join(".")] ?? null;
  } catch {
    return null;
  }
}
