import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditDigestWithBothProviders } from "../lib/audit";
import { corruptedDraft, fixtureCorpus } from "./audit-fixtures";

async function main() {
  const date = process.argv[2] ?? "2026-05-11";
  const report = await auditDigestWithBothProviders(corruptedDraft(date), fixtureCorpus(date));
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  const outputPath = path.join(process.cwd(), "data", `audit-compare-${date}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        openai: report.openai.verification_report.length,
        anthropic: report.anthropic.verification_report.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
