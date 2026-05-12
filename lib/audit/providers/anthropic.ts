import Anthropic from "@anthropic-ai/sdk";
import { auditReportJsonSchema } from "@/lib/json-schemas";
import { type Digest, type SourceArticle } from "@/lib/schema";
import { AUDIT_SYSTEM_PROMPT } from "../prompt";
import { parseJsonObject } from "@/lib/json";

const AUDIT_TOOL_NAME = "return_audit_report";

type AnthropicInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type AnthropicToolBlock = {
  type: "tool_use";
  name: string;
  input: unknown;
};

function isToolBlock(item: unknown): item is AnthropicToolBlock {
  const record = item as Record<string, unknown>;
  return (
    item !== null &&
    typeof item === "object" &&
    record.type === "tool_use" &&
    typeof record.name === "string" &&
    Object.prototype.hasOwnProperty.call(record, "input")
  );
}

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
    tools: [
      {
        name: AUDIT_TOOL_NAME,
        description: "Return the audited digest and verification report as structured JSON.",
        input_schema: auditReportJsonSchema as unknown as AnthropicInputSchema
      }
    ],
    tool_choice: { type: "tool", name: AUDIT_TOOL_NAME },
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

  const toolBlock = (response.content as unknown[]).find(
    (item): item is AnthropicToolBlock => isToolBlock(item) && item.name === AUDIT_TOOL_NAME
  );
  if (toolBlock?.input) return toolBlock.input;

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text" || !block.text) {
    const contentTypes = response.content.map((item) => item.type).join(", ") || "none";
    throw new Error(`Anthropic returned no text content. Content block types: ${contentTypes}`);
  }
  return parseJsonObject(block.text);
}
