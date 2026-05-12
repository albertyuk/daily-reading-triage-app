import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AuditReportSchema, type Digest, type SourceArticle } from "@/lib/schema";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function auditWithOpenAIRaw(draft: Digest, corpus: SourceArticle[]): Promise<unknown> {
  const response = await getOpenAI().responses.parse({
    model: "gpt-5.5",
    instructions: AUDIT_SYSTEM_PROMPT,
    input: [
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
    ],
    text: {
      format: zodTextFormat(AuditReportSchema, "audit_report")
    }
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed audit report");
  }
  return response.output_parsed;
}
