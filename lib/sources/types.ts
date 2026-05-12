import type { SourcePool, SourceType } from "@/lib/schema";

export type SourceConfig = {
  name: string;
  rss: string | null;
  type: SourceType;
  pool: SourcePool;
  adapter?: "rss" | "pitchbook_scrape" | "ap_scrape";
  disabled?: boolean;
};
