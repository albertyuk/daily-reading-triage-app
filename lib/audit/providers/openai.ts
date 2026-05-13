import OpenAI from "openai";
import type { Digest, SourceArticle } from "@/lib/schema";
import { logLLMCall } from "@/lib/observability/token-log";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getOpenAIAuditModel(): string {
  return process.env.OPENAI_AUDIT_MODEL ?? "gpt-5.5";
}

function parseJsonObject(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

export async function auditWithOpenAIRaw(draft: Digest, corpus: SourceArticle[]): Promise<unknown> {
  const t0 = Date.now();
  const response = await getOpenAI().responses.create({
    model: getOpenAIAuditModel(),
    instructions: AUDIT_SYSTEM_PROMPT,
    input: [
      {
        role: "user",
        content: JSON.stringify({
          draft,
          corpus,
          schema_note:
            `Return ONLY valid JSON matching AuditReportSchema. Set audit_provider to 'openai/${getOpenAIAuditModel()}'.`
        })
      }
    ],
    text: {
      format: { type: "json_object" }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI returned empty audit response");
  }

  const responseWithUsage = response as typeof response & {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      input_tokens_details?: { cached_tokens?: number };
      output_tokens_details?: { reasoning_tokens?: number };
    };
    _request_id?: string;
  };
  await logLLMCall(draft.date, {
    stage: "audit_openai",
    model: getOpenAIAuditModel(),
    input_tokens: responseWithUsage.usage?.input_tokens ?? 0,
    output_tokens: responseWithUsage.usage?.output_tokens ?? 0,
    thinking_tokens: responseWithUsage.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    cached_tokens: responseWithUsage.usage?.input_tokens_details?.cached_tokens ?? 0,
    duration_ms: Date.now() - t0,
    request_id: responseWithUsage._request_id
  });

  return parseJsonObject(response.output_text);
}
