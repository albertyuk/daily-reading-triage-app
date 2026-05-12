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
  },
  {
    name: "What's on Weibo",
    rss: "https://www.whatsonweibo.com/feed/",
    type: "free_rss",
    pool: "china"
  },
  {
    name: "Weibo Hot Search",
    rss: null,
    type: "scrape",
    pool: "china",
    adapter: "rsshub",
    rsshubPath: "/weibo/search/hot",
    feedContentOnly: true,
    minContentLength: 20
  },
  {
    name: "Weibo Social Watch",
    rss: null,
    type: "scrape",
    pool: "china",
    adapter: "rsshub",
    rsshubPathEnv: "WEIBO_RSSHUB_PATHS",
    feedContentOnly: true,
    minContentLength: 20
  },
  {
    name: "Xiaohongshu Social Watch",
    rss: null,
    type: "scrape",
    pool: "china",
    adapter: "rsshub",
    rsshubPathEnv: "XIAOHONGSHU_RSSHUB_PATHS",
    feedContentOnly: true,
    minContentLength: 20
  },
  {
    name: "Douyin Social Watch",
    rss: null,
    type: "scrape",
    pool: "china",
    adapter: "rsshub",
    rsshubPathEnv: "DOUYIN_RSSHUB_PATHS",
    feedContentOnly: true,
    minContentLength: 20
  }
];
