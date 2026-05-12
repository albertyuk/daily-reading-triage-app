import type { SourceConfig } from "./types";

export const chinaSources: SourceConfig[] = [
  {
    name: "China Daily China",
    rss: "http://www.chinadaily.com.cn/rss/china_rss.xml",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "China Daily BizChina",
    rss: "http://www.chinadaily.com.cn/rss/bizchina_rss.xml",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "Xinhua China",
    rss: "https://english.news.cn/rss/chinarss.xml",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "Xinhua Business",
    rss: "https://english.news.cn/rss/businessrss.xml",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "TechNode",
    rss: "https://technode.com/feed/",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "Pandaily",
    rss: "https://pandaily.com/feed/",
    type: "free_rss",
    pool: "china"
  }
];
