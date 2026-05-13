import { PageShell } from "@/components/PageShell";
import { ArticleDecisionTable } from "@/components/ArticleDecisionTable";
import { getArticleDecisions } from "@/lib/observability/article-decisions";
import { getRunSummary } from "@/lib/observability/run-summary";
import { getLLMCalls } from "@/lib/observability/token-log";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

function money(value: number | undefined) {
  return `$${(value ?? 0).toFixed(4)}`;
}

function ms(value: number | undefined) {
  if (!value) return "0s";
  return `${(value / 1000).toFixed(1)}s`;
}

export default async function RunPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [summary, decisions, calls, thinking, synthesisOutput, envelope] = await Promise.all([
    getRunSummary(date),
    getArticleDecisions(date),
    getLLMCalls(date),
    getStorage().getRunArtifact<string>(date, "synthesis-thinking.md"),
    getStorage().getRunArtifact<unknown>(date, "synthesis-output.json"),
    getStorage().getDigest(date)
  ]);

  if (!summary && !envelope) {
    return (
      <PageShell>
        <h1 className="m-0 text-4xl font-normal leading-tight text-ink">No run trace</h1>
        <p className="mt-4 text-muted">No run artifacts were found for {date}.</p>
      </PageShell>
    );
  }

  const publishedCount =
    (envelope?.digest.reading_queue.read_in_full.length ?? 0) +
    (envelope?.digest.reading_queue.worth_a_glance.length ?? 0) +
    (envelope?.digest.global.length ?? 0) +
    (envelope?.digest.for_you.length ?? 0);

  return (
    <PageShell>
      <header className="mb-10">
        <p className="mb-2 font-sans text-sm uppercase tracking-[0.12em] text-muted">Run Log</p>
        <h1 className="m-0 text-4xl font-normal leading-tight text-ink">{date}</h1>
      </header>

      <section className="grid gap-3 border-y border-rule py-5 font-sans text-sm sm:grid-cols-4">
        <div>
          <p className="m-0 text-muted">Cost</p>
          <p className="m-0 text-lg font-semibold text-ink">{money(summary?.llm_cost_usd)}</p>
        </div>
        <div>
          <p className="m-0 text-muted">Duration</p>
          <p className="m-0 text-lg font-semibold text-ink">{ms(summary?.duration_total_ms)}</p>
        </div>
        <div>
          <p className="m-0 text-muted">Surfaced</p>
          <p className="m-0 text-lg font-semibold text-ink">{publishedCount}</p>
        </div>
        <div>
          <p className="m-0 text-muted">Alerts</p>
          <p className="m-0 text-lg font-semibold text-ink">{summary?.audit.warnings ?? 0}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Pipeline Timeline
        </h2>
        <div className="mt-3 space-y-2 font-sans text-sm">
          {Object.entries(summary?.duration_by_stage ?? {}).map(([stage, duration]) => (
            <div key={stage} className="grid grid-cols-[110px_1fr_70px] items-center gap-3">
              <span className="text-muted">{stage}</span>
              <span className="h-2 bg-rule">
                <span
                  className="block h-2 bg-ink"
                  style={{ width: `${Math.min(100, ((duration ?? 0) / (summary?.duration_total_ms || 1)) * 100)}%` }}
                />
              </span>
              <span className="text-right text-muted">{ms(duration)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Source Health
        </h2>
        <div className="mt-3 overflow-x-auto border border-rule font-sans text-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-rule p-2">Source</th>
                <th className="border-b border-rule p-2">Pool</th>
                <th className="border-b border-rule p-2">Status</th>
                <th className="border-b border-rule p-2">Items</th>
                <th className="border-b border-rule p-2">Issue</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.source_health ?? []).map((source) => (
                <tr key={`${source.pool}-${source.source}`}>
                  <td className="border-b border-rule p-2">{source.source}</td>
                  <td className="border-b border-rule p-2">{source.pool}</td>
                  <td className="border-b border-rule p-2">{source.status}</td>
                  <td className="border-b border-rule p-2">{source.items_in_window}</td>
                  <td className="border-b border-rule p-2 text-muted">{source.issue ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Article Decisions
        </h2>
        <ArticleDecisionTable decisions={decisions} />
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Synthesis Thinking
        </h2>
        <details className="mt-3 border border-rule p-3 font-sans text-sm">
          <summary className="cursor-pointer font-semibold text-ink">Open trace</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-muted">{thinking ?? "Extended thinking was not captured for this run."}</pre>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Audit Decisions
        </h2>
        <div className="mt-3 space-y-2 font-sans text-sm">
          {(envelope?.verification_report ?? []).map((issue, index) => (
            <p key={`${issue.section}-${index}`} className="m-0 border-b border-rule pb-2">
              <span className="font-semibold text-ink">{issue.severity.toUpperCase()} {issue.section}.</span>{" "}
              <span className="text-muted">{issue.issue}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
          Costs
        </h2>
        <div className="mt-3 overflow-x-auto border border-rule font-sans text-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-rule p-2">Stage</th>
                <th className="border-b border-rule p-2">Model</th>
                <th className="border-b border-rule p-2">Input</th>
                <th className="border-b border-rule p-2">Output</th>
                <th className="border-b border-rule p-2">Cost</th>
                <th className="border-b border-rule p-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call, index) => (
                <tr key={`${call.stage}-${index}`}>
                  <td className="border-b border-rule p-2">{call.stage}</td>
                  <td className="border-b border-rule p-2">{call.model}</td>
                  <td className="border-b border-rule p-2">{call.input_tokens}</td>
                  <td className="border-b border-rule p-2">{call.output_tokens}</td>
                  <td className="border-b border-rule p-2">{money(call.cost_usd)}</td>
                  <td className="border-b border-rule p-2">{ms(call.duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {synthesisOutput ? (
        <section className="mt-10">
          <h2 className="font-sans text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
            Synthesis Output
          </h2>
          <details className="mt-3 border border-rule p-3 font-sans text-sm">
            <summary className="cursor-pointer font-semibold text-ink">Open JSON</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-muted">
              {JSON.stringify(synthesisOutput, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </PageShell>
  );
}
