import { formatDateInET } from "../lib/dates";
import { ingestAll } from "../lib/ingest";

async function main() {
  const date = process.argv[2] ?? formatDateInET();
  const corpus = await ingestAll(date);
  console.log(
    JSON.stringify(
      {
        date,
        curated: corpus.curated.length,
        global: corpus.global.length,
        discovery: corpus.discovery.length
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
