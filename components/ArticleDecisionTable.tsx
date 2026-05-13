"use client";

import { useMemo, useState } from "react";
import type { ArticleDecision } from "@/lib/observability/article-decisions";

export function ArticleDecisionTable({ decisions }: { decisions: ArticleDecision[] }) {
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState("all");
  const [sort, setSort] = useState<"source" | "decision" | "pool">("source");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...decisions]
      .filter((item) => (decision === "all" ? true : item.synthesis_decision === decision))
      .filter((item) =>
        q
          ? `${item.article_url} ${item.source_name} ${item.source_pool} ${item.synthesis_decision} ${item.synthesis_reasoning}`
              .toLowerCase()
              .includes(q)
          : true
      )
      .sort((a, b) => {
        if (sort === "decision") return a.synthesis_decision.localeCompare(b.synthesis_decision);
        if (sort === "pool") return a.source_pool.localeCompare(b.source_pool);
        return a.source_name.localeCompare(b.source_name);
      });
  }, [decisions, query, decision, sort]);

  return (
    <div>
      <div className="mb-3 grid gap-2 font-sans text-sm sm:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter articles"
          className="border border-rule bg-paper px-2 py-1 text-ink"
        />
        <select
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
          className="border border-rule bg-paper px-2 py-1 text-ink"
        >
          <option value="all">All decisions</option>
          <option value="read_in_full">Read in full</option>
          <option value="worth_a_glance">Worth a glance</option>
          <option value="skip">Skip</option>
          <option value="global_briefing">Global briefing</option>
          <option value="for_you">For You</option>
          <option value="not_selected">Not selected</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "source" | "decision" | "pool")}
          className="border border-rule bg-paper px-2 py-1 text-ink"
        >
          <option value="source">Sort by source</option>
          <option value="decision">Sort by decision</option>
          <option value="pool">Sort by pool</option>
        </select>
      </div>
      <div className="max-h-[620px] overflow-y-auto border border-rule font-sans text-sm">
        {filtered.map((item) => (
          <div key={item.article_url} className="border-b border-rule p-3 last:border-b-0">
            <p className="m-0">
              <a href={item.article_url} target="_blank" rel="noreferrer" className="font-semibold">
                {item.article_url}
              </a>
            </p>
            <p className="m-0 text-xs uppercase tracking-[0.08em] text-muted">
              {item.source_pool} · {item.source_name} · {item.synthesis_decision} · {item.audit_outcome}
            </p>
            <p className="m-0 mt-1 text-muted">{item.synthesis_reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
