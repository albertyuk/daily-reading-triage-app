import Anthropic from "@anthropic-ai/sdk";
import { type Digest, type SourceArticle } from "@/lib/schema";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";
import { parseJsonObject } from "@/lib/json";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function auditWithAnthropicRaw(draft: Digest, corpus: SourceArticle[]): Promise<unknown> {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: AUDIT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          draft,
          corpus,
          schema_note:
            "Return JSON matching AuditReportSchema. Set audit_provider to 'anthropic/claude-sonnet-4-6'. Return ONLY JSON, no preamble."
        })
      }
    ]
  });

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text" || !block.text) {
    throw new Error("Anthropic returned no text content");
  }
  return parseJsonObject(block.text);
}
