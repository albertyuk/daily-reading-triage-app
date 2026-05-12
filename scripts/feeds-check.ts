import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatDateInET } from "../lib/dates";
import { validateSourceFeeds } from "../lib/ingest";

async function main() {
  const results = await validateSourceFeeds();
  const date = formatDateInET();
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  const outputPath = path.join(process.cwd(), "data", `feed-check-${date}.json`);
  await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const failed = results.filter((result) => !result.ok);
  console.table(
    results.map((result) => ({
      source: result.source,
      pool: result.pool,
      ok: result.ok,
      disabled: result.disabled,
      items: result.item_count ?? 0,
      issue: result.issue ?? ""
    }))
  );
  console.log(`Wrote ${outputPath}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
