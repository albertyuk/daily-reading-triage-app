import OpenAI from "openai";
import type { Digest, SourceArticle } from "@/lib/schema";
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

  return parseJsonObject(response.output_text);
}
