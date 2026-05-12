import type { SourceConfig } from "./types";

export const curatedSources: SourceConfig[] = [
  {
    name: "Lenny's Newsletter",
    rss: "https://www.lennysnewsletter.com/feed",
    type: "free_rss",
    pool: "curated"
  },
  {
    name: "The Generalist",
    rss: "https://www.generalist.com/feed",
    type: "free_rss",
    pool: "curated"
  },
  {
    name: "Money Stuff",
    rss: null,
    type: "email_forward",
    pool: "curated",
    disabled: true
  },
  {
    name: "Stratechery",
    rss: null,
    type: "email_forward",
    pool: "curated",
    disabled: true
  },
  {
    name: "Marketing Examined",
    rss: "https://marketingexamined.com/feed",
    type: "free_rss",
    pool: "curated"
  },
  {
    name: "Why We Buy",
    rss: "https://customercamp.co/feed",
    type: "free_rss",
    pool: "curated"
  },
  {
    name: "Newcomer",
    rss: "https://www.newcomer.co/feed",
    type: "free_rss",
    pool: "curated"
  },
  {
    name: "Not Boring",
    rss: "https://www.notboring.co/feed",
    type: "free_rss",
    pool: "curated"
  }
];
