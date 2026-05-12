import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { AuditReportSchema, type Digest, type SourceArticle } from "@/lib/schema";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";
import { parseJsonObject } from "@/lib/json";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function auditWithOpenAIRaw(draft: Digest, corpus: SourceArticle[]): Promise<unknown> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.5",
    response_format: zodResponseFormat(AuditReportSchema, "audit_report"),
    messages: [
      { role: "system", content: AUDIT_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          draft,
          corpus,
          schema_note:
            "Return JSON matching AuditReportSchema. Set audit_provider to 'openai/gpt-5.5'."
        })
      }
    ]
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty response");
  return parseJsonObject(raw);
}
