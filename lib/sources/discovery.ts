import type { SourceConfig } from "./types";

export const discoverySources: SourceConfig[] = [
  {
    name: "TechCrunch",
    rss: "https://techcrunch.com/feed/",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "Hacker News (top)",
    rss: "https://hnrss.org/frontpage?points=200",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "Sifted",
    rss: "https://sifted.eu/feed",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "PitchBook News",
    rss: null,
    type: "scrape",
    pool: "discovery",
    adapter: "pitchbook_scrape"
  },
  {
    name: "Import AI",
    rss: "https://importai.substack.com/feed",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "One Useful Thing",
    rss: "https://www.oneusefulthing.org/feed",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "Marginal Revolution",
    rss: "https://feeds.feedblitz.com/marginalrevolution",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "The Daily Upside",
    rss: "https://www.thedailyupside.com/feed/",
    type: "free_rss",
    pool: "discovery"
  },
  {
    name: "What's on Weibo",
    rss: "https://www.whatsonweibo.com/feed/",
    type: "free_rss",
    pool: "discovery"
  }
];
