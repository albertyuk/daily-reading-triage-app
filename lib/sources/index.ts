import { curatedSources } from "./curated";
import { discoverySources } from "./discovery";
import { globalSources } from "./global";
import type { SourceConfig } from "./types";

export const sourcePools = {
  curated: curatedSources,
  global: globalSources,
  discovery: discoverySources
};

export const allSources: SourceConfig[] = [
  ...curatedSources,
  ...globalSources,
  ...discoverySources
];

export type { SourceConfig };
