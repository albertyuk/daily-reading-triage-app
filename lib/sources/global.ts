import type { SourceConfig } from "./types";

export const globalSources: SourceConfig[] = [
  {
    name: "Reuters Top News",
    rss: "https://www.reuters.com/rssfeed/topNews",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "Semafor Flagship",
    rss: "https://www.semafor.com/feed/flagship",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "AP Top News",
    rss: "https://feeds.apnews.com/rss/topnews",
    type: "free_rss",
    pool: "global"
  },
  {
    name: "BBC World",
    rss: "http://feeds.bbci.co.uk/news/world/rss.xml",
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
