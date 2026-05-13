import { curatedSources } from "./curated";
import { discoverySources } from "./discovery";
import { globalSources } from "./global";
import { chinaSources } from "./china";
import type { SourceConfig } from "./types";

export const sourcePools = {
  curated: curatedSources,
  global: globalSources,
  discovery: [...discoverySources, ...chinaSources]
};

export const allSources: SourceConfig[] = [
  ...curatedSources,
  ...globalSources,
  ...discoverySources,
  ...chinaSources
];

export type { SourceConfig };
