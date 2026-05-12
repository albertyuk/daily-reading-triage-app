import { notFound } from "next/navigation";
import { DigestView } from "@/components/DigestView";
import { PageShell } from "@/components/PageShell";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function DatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const envelope = await getStorage().getDigest(date);
  if (!envelope) notFound();

  return (
    <PageShell>
      <DigestView envelope={envelope} />
    </PageShell>
  );
}
