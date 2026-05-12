import Anthropic from "@anthropic-ai/sdk";
import { type Digest, type SourceArticle } from "@/lib/schema";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";
import { parseJsonObject } from "@/lib/json";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export function getAnthropicAuditModel(): string {
  return process.env.ANTHROPIC_AUDIT_MODEL ?? "claude-sonnet-4-6";
}

export async function auditWithAnthropicRaw(draft: Digest, corpus: SourceArticle[]): Promise<unknown> {
  const response = await getAnthropic().messages.create({
    model: getAnthropicAuditModel(),
    max_tokens: 8000,
    system: AUDIT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          draft,
          corpus,
          schema_note:
            `Return JSON matching AuditReportSchema. Set audit_provider to 'anthropic/${getAnthropicAuditModel()}'. Return ONLY JSON, no preamble.`
        })
      }
    ]
  });

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text" || !block.text) {
    const contentTypes = response.content.map((item) => item.type).join(", ") || "none";
    throw new Error(`Anthropic returned no text content. Content block types: ${contentTypes}`);
  }
  return parseJsonObject(block.text);
}
