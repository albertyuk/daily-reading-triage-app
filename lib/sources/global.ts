import type { SourceConfig } from "./types";

export const globalSources: SourceConfig[] = [
  {
    name: "AP Top News",
    rss: null,
    type: "scrape",
    pool: "global",
    adapter: "ap_scrape"
  },
  {
    name: "BBC World",
    rss: "http://feeds.bbci.co.uk/news/world/rss.xml",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "The Guardian World",
    rss: "https://www.theguardian.com/world/rss",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "NPR World",
    rss: "https://feeds.npr.org/1004/rss.xml",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "Al Jazeera",
    rss: "https://www.aljazeera.com/xml/rss/all.xml",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "DW Top Stories",
    rss: "https://rss.dw.com/rdf/rss-en-top",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "France 24",
    rss: "https://www.france24.com/en/rss",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "FT Top Stories",
    rss: "https://www.ft.com/rss/home",
    type: "free_rss",
    pool: "global"
  }
];
