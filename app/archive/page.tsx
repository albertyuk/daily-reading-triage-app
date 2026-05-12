import { PageShell } from "@/components/PageShell";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const digests = await getStorage().listDigests();

  return (
    <PageShell>
      <header className="mb-10">
        <p className="mb-2 font-sans text-sm uppercase tracking-[0.12em] text-muted">
          Daily Reading Triage
        </p>
        <h1 className="m-0 text-4xl font-normal leading-tight text-ink">Archive</h1>
      </header>

      {digests.length === 0 ? (
        <p className="text-muted">No published digests yet.</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {digests.map((envelope) => (
            <li key={envelope.date} className="border-b border-rule py-5">
              <a href={`/${envelope.date}`} className="font-sans text-lg font-semibold no-underline">
                {envelope.date}
              </a>
              <p className="m-0 mt-1 font-sans text-sm text-muted">
                {envelope.digest.total_word_count} words · {envelope.stats.read_in_full_count} full ·{" "}
                {envelope.stats.worth_a_glance_count} glance · {envelope.audit_provider}
              </p>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
