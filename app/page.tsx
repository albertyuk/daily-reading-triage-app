import { DigestView } from "@/components/DigestView";
import { PageShell } from "@/components/PageShell";
import { formatDateInET } from "@/lib/dates";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const date = formatDateInET();
  const envelope = await getStorage().getDigest(date);

  return (
    <PageShell>
      {envelope ? (
        <DigestView envelope={envelope} />
      ) : (
        <section>
          <p className="mb-2 font-sans text-sm uppercase tracking-[0.12em] text-muted">
            Daily Reading Triage
          </p>
          <h1 className="m-0 text-4xl font-normal leading-tight text-ink">No digest yet</h1>
          <p className="mt-4 text-muted">The digest for {date} has not been published.</p>
        </section>
      )}
    </PageShell>
  );
}
