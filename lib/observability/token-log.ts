import { getStorage } from "@/lib/storage";

export type LLMCall = {
  stage: "synthesis" | "audit_openai" | "audit_anthropic_fallback" | "cross_item_audit";
  model: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens?: number;
  cached_tokens?: number;
  duration_ms: number;
  cost_usd: number;
  request_id?: string;
  timestamp: string;
};

export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-7": { in: 15, out: 75 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "gpt-5.5": { in: 5, out: 30 }
};

export type RunSummary = {
  date: string;
  llm_cost_usd: number;
  llm_calls: number;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cached_tokens: number;
  calls: LLMCall[];
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] ?? PRICING[model.replace(/^.*\//, "")];
  if (!pricing) return 0;
  return (inputTokens * pricing.in + outputTokens * pricing.out) / 1_000_000;
}

export async function logLLMCall(date: string, call: Omit<LLMCall, "timestamp" | "cost_usd"> & { cost_usd?: number }) {
  const cost_usd = call.cost_usd ?? estimateCostUsd(call.model, call.input_tokens, call.output_tokens);
  await getStorage().appendRunEntry(date, "llm-calls", {
    ...call,
    cost_usd,
    timestamp: new Date().toISOString()
  } satisfies LLMCall);
}

export async function getLLMCalls(date: string): Promise<LLMCall[]> {
  return (await getStorage().getRunArtifact<LLMCall[]>(date, "llm-calls.jsonl")) ?? [];
}

export async function summarizeRun(date: string): Promise<RunSummary> {
  const calls = await getLLMCalls(date);
  return {
    date,
    llm_cost_usd: Number(calls.reduce((sum, call) => sum + call.cost_usd, 0).toFixed(4)),
    llm_calls: calls.length,
    input_tokens: calls.reduce((sum, call) => sum + call.input_tokens, 0),
    output_tokens: calls.reduce((sum, call) => sum + call.output_tokens, 0),
    thinking_tokens: calls.reduce((sum, call) => sum + (call.thinking_tokens ?? 0), 0),
    cached_tokens: calls.reduce((sum, call) => sum + (call.cached_tokens ?? 0), 0),
    calls
  };
}
