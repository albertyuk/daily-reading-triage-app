import Anthropic from "@anthropic-ai/sdk";
import { digestJsonSchema } from "@/lib/json-schemas";
import { DigestSchema, type CorpusBundle, type Digest, type SourceArticle } from "@/lib/schema";
import { interestProfile } from "@/lib/interest-profile";
import { parseJsonObject } from "@/lib/json";
import { computeDigestWordCount, truncateChars } from "@/lib/text";

const DIGEST_TOOL_NAME = "return_digest";

type AnthropicInputSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export const SYNTHESIS_SYSTEM_PROMPT = `
You are running a daily reading triage for one specific reader. You are NOT writing 
a newsletter that replaces their reading — you are filtering and surfacing so they 
read more efficiently. The reader has limited time and high intelligence; treat both 
as scarce resources.

You will receive four inputs in the user message:
1. CURATED_CORPUS — all posts from the reader's subscribed newsletters in the last 24h
2. GLOBAL_CORPUS — top stories from major news sources in the last 24h
3. DISCOVERY_CORPUS — broader source pool to filter for personalization
4. INTEREST_PROFILE — the reader's interests, context, and what to surface or avoid

For CURATED_CORPUS, triage every piece into:

- read_in_full (max 3 per day): piece is so good, dense, or important that any summary 
  destroys value. Reserve this tier for genuinely exceptional pieces. Most days will 
  have 0-1 items here, not 3.

- worth_a_glance (5-8 per day): piece has a real insight that compresses to 30-50 
  words without significant loss. Surface the insight with attribution and link.

- skip: piece is light, repetitive, off-topic for the reader, or housekeeping. Don't 
  include — just count.

ATTRIBUTION RULES (critical):
- Always use the author's name and link to their original post.
- Paraphrase in your own words. Never reproduce more than 10 consecutive words verbatim 
  from any source.
- For worth_a_glance items: write 30-50 words capturing the author's core argument in 
  YOUR framing, not theirs. Do not mimic their voice.
- For read_in_full items: write a single sentence of orientation — what it's about and 
  why it earned the slot. Do NOT summarize the argument.

CROSS-CUTTING THEMES:
- Identify when 2+ pieces in CURATED_CORPUS converge on a trend.
- 2-3 sentences synthesizing the cross-source insight + links to all underlying pieces.
- Max 3 themes. Return empty array if no clear convergence. Do not manufacture themes.

NEW IN THE LEXICON:
- Extract named frameworks, coined terms, or notable new concepts introduced today.
- One-sentence paraphrased definition + link to introducing piece + author name.
- Max 5 entries. Empty array if nothing qualifies.

GLOBAL BRIEFING:
- From GLOBAL_CORPUS, select 5-7 stories with broadest impact today.
- Per item: clear headline + 60-80 word paraphrase + inline source link(s).
- Dry, factual tone. Surface conflicts between sources explicitly when present.
- Do not include single-source rumors or speculation.

FOR YOU:
- From DISCOVERY_CORPUS, select 3-5 items that match INTEREST_PROFILE.
- Per item: headline + 40-60 word paraphrase + one phrase identifying which profile 
  element this matches + link.
- Only surface clear interest-profile matches. Generic items do not qualify.
- De-prioritize discovery items that closely overlap with anything in the curated queue.

VOICE:
- Smart, dry, declarative. Zero hype words.
- One idea per sentence. No throat-clearing.
- Closer to The Generalist or Money Stuff than Morning Brew.

OUTPUT:
Return only valid JSON matching DigestSchema (defined in user message). No preamble.
`;

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getSynthesisModel(): string {
  return process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-opus-4-7";
}

function compactArticle(article: SourceArticle): SourceArticle {
  const maxChars = Number(process.env.MAX_ARTICLE_CHARS ?? 12000);
  return {
    ...article,
    content: truncateChars(article.content, maxChars),
    raw: undefined
  };
}

function compactCorpus(corpus: CorpusBundle): CorpusBundle {
  const maxPerPool = Number(process.env.MAX_CORPUS_ARTICLES_PER_POOL ?? 40);
  return {
    date: corpus.date,
    curated: corpus.curated.slice(0, maxPerPool).map(compactArticle),
    global: corpus.global.slice(0, maxPerPool).map(compactArticle),
    discovery: corpus.discovery.slice(0, maxPerPool).map(compactArticle)
  };
}

function schemaNote(): string {
  return `
DigestSchema:
{
  date: string,
  reading_queue: {
    read_in_full: TriageItem[],
    worth_a_glance: TriageItem[],
    skipped_count: number,
    skip_reason_summary: string
  },
  themes: Theme[],
  lexicon: LexiconEntry[],
  global: GlobalItem[],
  for_you: ForYouItem[],
  total_word_count: number
}

TriageItem: { author, source, url, tier: "read_in_full" | "worth_a_glance", text, estimated_read_minutes? }
Theme: { name, synthesis, underlying_pieces: [{ author, source, url }] }
LexiconEntry: { term, definition, introduced_by, source, url }
GlobalItem: { headline, body, sources: string[] }
ForYouItem: { headline, body, why_for_you, url, source }
`;
}

function buildSynthesisUserMessage(corpus: CorpusBundle, extraInstruction?: string): string {
  const compacted = compactCorpus(corpus);
  return JSON.stringify(
    {
      CURATED_CORPUS: compacted.curated,
      GLOBAL_CORPUS: compacted.global,
      DISCOVERY_CORPUS: compacted.discovery,
      INTEREST_PROFILE: interestProfile,
      DIGEST_DATE: corpus.date,
      DIGEST_SCHEMA: schemaNote(),
      extra_instruction: extraInstruction
    },
    null,
    2
  );
}

type AnthropicContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
};

function extractStructuredOutput(
  response: { content: AnthropicContentBlock[]; stop_reason?: string | null },
  toolName: string
): unknown {
  const toolBlock = response.content.find(
    (item) => item.type === "tool_use" && item.name === toolName && item.input
  );
  if (toolBlock?.input) return toolBlock.input;

  const block = response.content.find((item) => item.type === "text");
  if (block?.text) return parseJsonObject(block.text);

  const contentTypes = response.content.map((item) => item.type).join(", ") || "none";
  throw new Error(
    `Anthropic returned no structured output. Stop reason: ${response.stop_reason ?? "unknown"}. Content block types: ${contentTypes}`
  );
}

function normalizeDigest(digest: Digest): Digest {
  return {
    ...digest,
    total_word_count: computeDigestWordCount({
      reading_queue: digest.reading_queue,
      themes: digest.themes,
      lexicon: digest.lexicon,
      global: digest.global,
      for_you: digest.for_you
    })
  };
}

async function callClaudeForDigest(corpus: CorpusBundle, extraInstruction?: string): Promise<Digest> {
  const response = await getAnthropic().messages.create({
    model: getSynthesisModel(),
    max_tokens: 8000,
    system: SYNTHESIS_SYSTEM_PROMPT,
    tools: [
      {
        name: DIGEST_TOOL_NAME,
        description: "Return the completed daily digest as structured JSON.",
        input_schema: digestJsonSchema as unknown as AnthropicInputSchema
      }
    ],
    tool_choice: { type: "tool", name: DIGEST_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: buildSynthesisUserMessage(corpus, extraInstruction)
      }
    ]
  });

  const parsed = extractStructuredOutput(response, DIGEST_TOOL_NAME);
  return DigestSchema.parse(normalizeDigest(DigestSchema.parse(parsed)));
}

export async function synthesize(corpus: CorpusBundle): Promise<Digest> {
  try {
    return await callClaudeForDigest(corpus);
  } catch (error) {
    return callClaudeForDigest(
      corpus,
      `The previous response failed schema validation with: ${
        error instanceof Error ? error.message : String(error)
      }. Return corrected JSON only.`
    );
  }
}

export async function repairDigestForAudit(
  draft: unknown,
  corpus: SourceArticle[],
  validationIssue: string
): Promise<Digest> {
  const response = await getAnthropic().messages.create({
    model: getSynthesisModel(),
    max_tokens: 6000,
    system:
      "You repair a daily reading digest JSON so it validates against DigestSchema. Preserve all valid items, replace only missing or invalid required items using the provided corpus, and return only JSON.",
    tools: [
      {
        name: DIGEST_TOOL_NAME,
        description: "Return the repaired daily digest as structured JSON.",
        input_schema: digestJsonSchema as unknown as AnthropicInputSchema
      }
    ],
    tool_choice: { type: "tool", name: DIGEST_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            validationIssue,
            draft,
            corpus: corpus.map(compactArticle),
            schema_note: schemaNote()
          },
          null,
          2
        )
      }
    ]
  });

  const parsed = extractStructuredOutput(response, DIGEST_TOOL_NAME);
  return DigestSchema.parse(normalizeDigest(DigestSchema.parse(parsed)));
}
