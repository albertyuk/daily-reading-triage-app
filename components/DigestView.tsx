import type { Digest, PublishedDigestEnvelope, TriageItem } from "@/lib/schema";

function Section({
  title,
  children,
  muted
}: {
  title: string;
  children: React.ReactNode;
  muted?: string;
}) {
  return (
    <section className="mt-14">
      <div className="mb-5 border-b border-rule pb-2">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          {title}
        </h2>
        {muted ? <p className="mt-1 font-sans text-sm text-muted">{muted}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ItemLink({ item }: { item: { url: string; source?: string; headline?: string } }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer">
      {item.source ?? item.headline ?? "Source"}
    </a>
  );
}

function TriageItemView({ item, spacious = false }: { item: TriageItem; spacious?: boolean }) {
  return (
    <li className={spacious ? "mb-8" : "mb-5"}>
      <p className="m-0">
        <span className="font-sans text-[15px] font-semibold text-ink">{item.source}</span>
        <span className="font-sans text-[15px] text-muted"> by {item.author}. </span>
        {item.text} <ItemLink item={item} />
      </p>
      {item.estimated_read_minutes ? (
        <p className="mt-1 font-sans text-sm text-muted">{item.estimated_read_minutes} min read</p>
      ) : null}
    </li>
  );
}

export function DigestView({ envelope }: { envelope: PublishedDigestEnvelope }) {
  const digest: Digest = envelope.digest;

  return (
    <article>
      <header className="mb-12">
        <p className="mb-2 font-sans text-sm uppercase tracking-[0.12em] text-muted">
          Daily Reading Triage
        </p>
        <h1 className="m-0 text-4xl font-normal leading-tight text-ink">{digest.date}</h1>
        <p className="mt-4 font-sans text-sm text-muted">
          {digest.total_word_count} words. Audit via {envelope.audit_provider}.
        </p>
      </header>

      <Section
        title="Today's Reading Queue"
        muted={`${digest.reading_queue.skipped_count} skipped: ${digest.reading_queue.skip_reason_summary}`}
      >
        {digest.reading_queue.read_in_full.length > 0 ? (
          <>
            <h3 className="mb-4 font-sans text-base font-semibold text-ink">Worth Reading In Full</h3>
            <ul className="m-0 list-none p-0">
              {digest.reading_queue.read_in_full.map((item) => (
                <TriageItemView key={item.url} item={item} spacious />
              ))}
            </ul>
          </>
        ) : null}

        {digest.reading_queue.worth_a_glance.length > 0 ? (
          <>
            <h3 className="mb-4 mt-8 font-sans text-base font-semibold text-ink">Worth A Glance</h3>
            <ul className="m-0 list-none p-0">
              {digest.reading_queue.worth_a_glance.map((item) => (
                <TriageItemView key={item.url} item={item} />
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      <Section title="Cross-Cutting Themes">
        {digest.themes.length === 0 ? (
          <p className="font-sans text-sm text-muted">No clear convergence today.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {digest.themes.map((theme) => (
              <li key={theme.name} className="mb-6">
                <h3 className="mb-1 font-sans text-base font-semibold text-ink">{theme.name}</h3>
                <p className="m-0">{theme.synthesis}</p>
                <p className="mt-1 font-sans text-sm text-muted">
                  {theme.underlying_pieces.map((piece, index) => (
                    <span key={piece.url}>
                      {index > 0 ? " · " : ""}
                      <a href={piece.url} target="_blank" rel="noreferrer">
                        {piece.source}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="New In The Lexicon">
        {digest.lexicon.length === 0 ? (
          <p className="font-sans text-sm text-muted">No durable terms today.</p>
        ) : (
          <dl className="m-0">
            {digest.lexicon.map((entry) => (
              <div key={`${entry.term}-${entry.url}`} className="mb-5">
                <dt className="font-sans text-base font-semibold text-ink">{entry.term}</dt>
                <dd className="m-0">
                  {entry.definition}{" "}
                  <a href={entry.url} target="_blank" rel="noreferrer">
                    {entry.source}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="Global Briefing">
        <ul className="m-0 list-none p-0">
          {digest.global.map((item) => (
            <li key={item.headline} className="mb-7">
              <h3 className="mb-1 font-sans text-base font-semibold text-ink">{item.headline}</h3>
              <p className="m-0">{item.body}</p>
              <p className="mt-1 font-sans text-sm text-muted">
                {item.sources.map((source, index) => (
                  <span key={source}>
                    {index > 0 ? " · " : ""}
                    <a href={source} target="_blank" rel="noreferrer">
                      source
                    </a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="For You">
        {digest.for_you.length === 0 ? (
          <p className="font-sans text-sm text-muted">No discovery item cleared the bar today.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {digest.for_you.map((item) => (
              <li key={item.url} className="mb-6">
                <h3 className="mb-1 font-sans text-base font-semibold text-ink">
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.headline}
                  </a>
                </h3>
                <p className="m-0">{item.body}</p>
                <p className="mt-1 font-sans text-sm text-muted">
                  {item.why_for_you} · {item.source}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}
