import { auditDigest } from "../lib/audit";
import { corruptedDraft, fixtureCorpus } from "./audit-fixtures";

async function main() {
  const date = process.argv[2] ?? "2026-05-11";
  const report = await auditDigest(corruptedDraft(date), fixtureCorpus(date), "openai");
  const failures = report.verification_report.filter((item) => item.severity === "fail");
  console.log(JSON.stringify(report.verification_report, null, 2));
  console.log(`Failures: ${failures.length}`);
  if (failures.length < 3) {
    throw new Error("Expected audit to catch bad URL, wrong number, and misattributed quote.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
