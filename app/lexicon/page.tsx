import { PageShell } from "@/components/PageShell";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function LexiconPage() {
  const entries = await getStorage().getLexicon();

  return (
    <PageShell>
      <header className="mb-10">
        <p className="mb-2 font-sans text-sm uppercase tracking-[0.12em] text-muted">
          Daily Reading Triage
        </p>
        <h1 className="m-0 text-4xl font-normal leading-tight text-ink">Lexicon</h1>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted">No lexicon entries yet.</p>
      ) : (
        <dl className="m-0">
          {entries.map((entry) => (
            <div key={`${entry.term}-${entry.url}`} className="border-b border-rule py-5">
              <dt className="font-sans text-lg font-semibold text-ink">{entry.term}</dt>
              <dd className="m-0 mt-1">
                {entry.definition}{" "}
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.source}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </PageShell>
  );
}
