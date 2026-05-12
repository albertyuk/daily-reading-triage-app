import { formatDateInET } from "../lib/dates";
import { runDailyPipeline } from "../lib/pipeline";

async function main() {
  const date = process.argv[2] ?? formatDateInET();
  const envelope = await runDailyPipeline(date);
  console.log(JSON.stringify(envelope.stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
