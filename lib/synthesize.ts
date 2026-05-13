import Anthropic from "@anthropic-ai/sdk";
import { digestJsonSchema } from "@/lib/json-schemas";
import { DigestSchema, type CorpusBundle, type Digest, type GlobalItem, type SourceArticle } from "@/lib/schema";
import { interestProfile } from "@/lib/interest-profile";
import { parseJsonObject } from "@/lib/json";
import { computeDigestWordCount, truncateChars, truncateWords } from "@/lib/text";

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
4. CHINA_CORPUS — China-focused general, business, technology, and social-media signals
5. INTEREST_PROFILE — the reader's interests, context, and what to surface or avoid

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
- Avoid direct quotations entirely in digest text unless the exact quotation is indispensable.
- Do not put paraphrases, slogans, positioning, or your own labels in quotation marks.
- Do not mention a named person, company, product, model, country, market, valuation, date, or number unless it appears in at least one cited source for that same item.
- Do not add outside comparisons. If a cited item is about Kuaishou, do not compare it to Runway, Pika, OpenAI, Sora, Google, or Gemini unless those names appear in the cited source(s) for that item.
- Item headlines must not advance beyond the cited source. Use "heads to" instead of "lands in" unless the source says the person arrived.
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
- Per item: clear headline + 60-90 word paraphrase + inline source link(s).
- Prefer synthesizing across 2+ sources when multiple sources cover the same event.
- Use 1 source when only 1 source covers the event; do not force multi-source synthesis by importing unrelated context.
- Surface conflicts between sources explicitly when present, e.g. "AP reports X; BBC emphasizes Y."
- Avoid making the section a list of unrelated single-source summaries when cross-source convergence exists.
- Every sentence must be supported by at least one URL in that item's sources array.
- Diversify sources. When GLOBAL_CORPUS contains 4+ source organizations, the final global section should normally use at least 4 distinct source organizations, and no single outlet should dominate.
- Prioritize stories that teach the reader about geopolitics, macroeconomics, markets, technology, institutions, public health, climate, war, migration, elections, trade, regulation, or major corporate strategy.
- Omit isolated local crime, celebrity lawsuits, routine court cases, oddities, weather incidents, sports recaps, and human-interest pieces unless they clearly reveal a larger system-level trend.
- A story should answer: "What does this teach a sharp reader about how the world works today?"
- Dry, factual tone.
- Do not include single-source rumors or speculation.

CHINA BRIEFING:
- From CHINA_CORPUS, select 3-5 major China items spanning general news, business/policy, and technology.
- CHINA_CORPUS may include social-media signals from Weibo, Xiaohongshu, or Douyin via RSSHub.
- Treat official/state media as valuable signal but not neutral ground truth. Attribute carefully.
- Treat social-media trends as signals, not confirmed facts. Use them to surface emerging attention, consumer behavior, or tech/culture chatter, and distinguish them from reported news.
- Synthesize across multiple Chinese-media sources when possible.
- Use 1 source when only 1 source covers the event; do not add global AI-market comparisons unless the cited source makes them.
- If one source emphasizes policy framing and another emphasizes market or technology effects, state that difference.
- Include tech/business items with downstream relevance for HK markets, startups, AI, hardware, platforms, or creative tools.
- Diversify sources. When CHINA_CORPUS contains 4+ source organizations, the final China section should normally use at least 3 distinct source organizations, with a mix of official/state, business/tech, and social/culture sources when available.
- Omit routine propaganda, ceremonial diplomacy, isolated crime, celebrity gossip, product listicles, and local-interest stories unless they clearly teach something about policy, markets, platforms, consumer behavior, technology, or culture.

FOR YOU:
- From DISCOVERY_CORPUS, select 3-5 items that match INTEREST_PROFILE.
- Per item: headline + 40-60 word paraphrase + one phrase identifying which profile 
  element this matches + link.
- Only surface clear interest-profile matches. Generic items do not qualify.
- De-prioritize discovery items that closely overlap with anything in the curated queue.
- Do not invent quotes or catchy framings. Keep all quoted text out of this section.

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

export function getSynthesisModel(): string {
  return process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-opus-4-7";
}

export function getSynthesisProviderLabel(): string {
  return `anthropic/${getSynthesisModel()}`;
}

function compactArticle(article: SourceArticle): SourceArticle {
  const maxChars = Number(process.env.MAX_ARTICLE_CHARS ?? 3500);
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
    discovery: corpus.discovery.slice(0, maxPerPool).map(compactArticle),
    china: corpus.china.slice(0, maxPerPool).map(compactArticle)
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
  china: GlobalItem[],
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
      CHINA_CORPUS: compacted.china,
      INTEREST_PROFILE: interestProfile,
      DIGEST_DATE: corpus.date,
      DIGEST_SCHEMA: schemaNote(),
      STRICT_SHAPE_REQUIREMENTS:
        "Top-level reading_queue MUST be an object. Top-level global MUST be an array of 5-7 GlobalItem objects. Top-level china MUST be an array, even when empty. Top-level for_you MUST be an array, even when empty. total_word_count MUST be a number; it may be approximate because the server recomputes it.",
      QUALITY_REQUIREMENTS:
        "If DISCOVERY_CORPUS has at least 10 items, for_you should normally contain 3-5 clear matches to the interest profile. If CHINA_CORPUS has at least 5 items, china should normally contain 3-5 major China items. Global items should usually cite 2+ sources when multiple sources cover the same story, but never combine unrelated sources just to reach 2 links. Use at least 4 distinct global source organizations and 3 distinct China source organizations when available. Omit low-value local crime, celebrity, entertainment, sports, oddity, and human-interest stories unless they reveal a major structural trend. Return empty arrays only when there are truly no credible matches. Do not use internal phrases such as schema repair in user-visible text. Avoid quotation marks and unsupported outside comparisons.",
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
      china: digest.china,
      for_you: digest.for_you
    })
  };
}

function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function buildBriefingFallback(articles: SourceArticle[], limit: number) {
  return diversifyArticles(articles.filter((article) => !isLowValueBriefingArticle(article)), limit).map((article) => ({
    headline: article.title,
    body: truncateWords(article.content || article.excerpt || article.title, 75),
    sources: [article.url]
  }));
}

function isLowValueBriefingArticle(article: SourceArticle): boolean {
  const text = `${article.title} ${article.excerpt ?? ""}`.toLowerCase();
  const lowValuePatterns = [
    /\bgroom\b/,
    /\bwedding night\b/,
    /\bbest friend\b/,
    /\bben affleck\b/,
    /\bmatt damon\b/,
    /\bcelebrity\b/,
    /\bmovie\b/,
    /\bthe rip\b/,
    /\bsports?\b/,
    /\bviral\b/,
    /\bodd\b/,
    /\bweird\b/,
    /\bkilled\b/,
    /\bmurder\b/,
    /\bsues?\b/,
    /\blawsuit\b/
  ];
  const highValuePatterns = [
    /\belection\b/,
    /\btrade\b/,
    /\btariff\b/,
    /\bcentral bank\b/,
    /\binflation\b/,
    /\bwar\b/,
    /\bceasefire\b/,
    /\bchina\b/,
    /\brussia\b/,
    /\biran\b/,
    /\bmarkets?\b/,
    /\bai\b/,
    /\bsemiconductor\b/,
    /\bclimate\b/,
    /\bpolicy\b/,
    /\bregulation\b/,
    /\bipo\b/,
    /\bantitrust\b/,
    /\bdoj\b/,
    /\bsec\b/,
    /\bftc\b/,
    /\bsupreme court\b/,
    /\bfederal\b/,
    /\bgovernment\b/,
    /\bregulator\b/
  ];

  return lowValuePatterns.some((pattern) => pattern.test(text)) && !highValuePatterns.some((pattern) => pattern.test(text));
}

function diversifyArticles(articles: SourceArticle[], limit: number): SourceArticle[] {
  const selected: SourceArticle[] = [];
  const counts = new Map<string, number>();

  for (const article of articles) {
    const count = counts.get(article.source) ?? 0;
    if (count >= 2) continue;
    selected.push(article);
    counts.set(article.source, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const article of articles) {
    if (selected.some((item) => item.url === article.url)) continue;
    selected.push(article);
    if (selected.length >= limit) break;
  }

  return selected;
}

function sourceDiversityForItems(items: GlobalItem[], corpus: SourceArticle[]): Set<string> {
  const sourceByUrl = new Map(corpus.map((article) => [article.url, article.source]));
  const names = new Set<string>();
  for (const item of items) {
    for (const url of item.sources) {
      const source = sourceByUrl.get(url);
      if (source) names.add(source);
    }
  }
  return names;
}

function hasLowValueBriefingItem(items: GlobalItem[]): boolean {
  return items.some((item) =>
    isLowValueBriefingArticle({
      id: item.headline,
      date: "",
      title: item.headline,
      author: "",
      source: "",
      url: item.sources[0] ?? "https://example.com",
      published_at: new Date(0).toISOString(),
      content: item.body,
      source_pool: "global",
      source_type: "free_rss",
      word_count: 0
    })
  );
}

function coerceDigestCandidate(candidate: unknown, corpus: CorpusBundle): unknown {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return candidate;
  const draft = { ...(candidate as Record<string, unknown>) };

  draft.reading_queue = tryParseJsonString(draft.reading_queue);
  if (!draft.reading_queue || typeof draft.reading_queue !== "object" || Array.isArray(draft.reading_queue)) {
    draft.reading_queue = {
      read_in_full: [],
      worth_a_glance: [],
      skipped_count: corpus.curated.length,
      skip_reason_summary:
        corpus.curated.length === 0
          ? "Curated corpus was empty today; no subscribed newsletters delivered posts in the last 24h."
          : "Curated items were ingested, but none cleared the reading threshold."
    };
  }

  draft.themes = tryParseJsonString(draft.themes);
  if (!Array.isArray(draft.themes)) {
    draft.themes = [];
  }

  draft.lexicon = tryParseJsonString(draft.lexicon);
  if (!Array.isArray(draft.lexicon)) {
    draft.lexicon = [];
  }

  draft.global = tryParseJsonString(draft.global);
  if (!Array.isArray(draft.global) || draft.global.length < 5) {
    const fallbackGlobal = buildBriefingFallback(corpus.global, 7);
    if (fallbackGlobal.length >= 5) {
      draft.global = fallbackGlobal;
    }
  }

  draft.china = tryParseJsonString(draft.china);
  if (!Array.isArray(draft.china)) {
    draft.china = buildBriefingFallback(corpus.china, 5);
  }

  draft.for_you = tryParseJsonString(draft.for_you);
  if (!Array.isArray(draft.for_you)) {
    draft.for_you = [];
  }

  if (typeof draft.total_word_count !== "number") {
    draft.total_word_count = 0;
  }

  return draft;
}

function qualityRepairInstruction(digest: Digest, corpus: CorpusBundle): string | undefined {
  const issues: string[] = [];

  if (digest.reading_queue.skip_reason_summary.toLowerCase().includes("schema repair")) {
    issues.push("reading_queue contains internal schema-repair wording");
  }

  if (corpus.discovery.length >= 10 && digest.for_you.length === 0) {
    issues.push(
      `for_you is empty even though ${corpus.discovery.length} discovery items were ingested`
    );
  }

  if (corpus.china.length >= 5 && digest.china.length === 0) {
    issues.push(`china is empty even though ${corpus.china.length} China-source items were ingested`);
  }

  if (digest.global.filter((item) => item.sources.length >= 2).length === 0) {
    issues.push("global briefing contains no multi-source synthesized items where sources clearly overlap");
  }

  const globalCorpusSources = new Set(corpus.global.map((article) => article.source));
  const globalDigestSources = sourceDiversityForItems(digest.global, corpus.global);
  if (globalCorpusSources.size >= 4 && globalDigestSources.size < 4) {
    issues.push(
      `global briefing uses only ${globalDigestSources.size} source organizations despite ${globalCorpusSources.size} available`
    );
  }

  const chinaCorpusSources = new Set(corpus.china.map((article) => article.source));
  const chinaDigestSources = sourceDiversityForItems(digest.china, corpus.china);
  if (chinaCorpusSources.size >= 4 && digest.china.length >= 3 && chinaDigestSources.size < 3) {
    issues.push(
      `China briefing uses only ${chinaDigestSources.size} source organizations despite ${chinaCorpusSources.size} available`
    );
  }

  if (hasLowValueBriefingItem([...digest.global, ...digest.china])) {
    issues.push("briefing includes low-value local crime, celebrity, entertainment, oddity, or routine legal items");
  }

  if (digest.total_word_count < 900 && corpus.global.length >= 5 && corpus.discovery.length >= 10) {
    issues.push(
      `digest is only ${digest.total_word_count} words despite enough global and discovery material`
    );
  }

  if (issues.length === 0) return undefined;

  return `The previous digest validated structurally but failed product-quality checks: ${issues.join(
    "; "
  )}. Rebuild the digest from the source corpus. Keep read_in_full selective. If the only curated item is weak, it may be skipped, but write a normal reader-facing skip reason. Include 5-7 global items, 3-5 China items, and 3-5 for_you items when they clearly match the interest profile. Cluster global stories across sources only when sources cover the same event. Cite 2+ sources when coverage overlaps; otherwise cite one source and stay inside it. Use at least 4 distinct global sources and 3 distinct China sources when available. Omit local crime, celebrity lawsuits, entertainment disputes, sports, oddities, and isolated human-interest items unless they reveal a larger system-level trend. Remove quotation marks and outside comparisons. Target at least 900 words on sparse curated days.`;
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

  const parsed = coerceDigestCandidate(extractStructuredOutput(response, DIGEST_TOOL_NAME), corpus);
  return DigestSchema.parse(normalizeDigest(DigestSchema.parse(parsed)));
}

export async function synthesize(corpus: CorpusBundle): Promise<Digest> {
  let firstError: unknown;
  try {
    const digest = await callClaudeForDigest(corpus);
    const repairInstruction = qualityRepairInstruction(digest, corpus);
    if (!repairInstruction) return digest;
    return await callClaudeForDigest(corpus, repairInstruction);
  } catch (error) {
    firstError = error;
  }

  try {
    return await callClaudeForDigest(
      corpus,
      `The previous response failed schema validation with: ${
        firstError instanceof Error ? firstError.message : String(firstError)
      }. Correct the STRUCTURE, not just wording. Return a tool input where global is an array, china is an array, for_you is an array, and total_word_count is a number.`
    );
  } catch (secondError) {
    return await callClaudeForDigest(
      corpus,
      `The last two responses failed validation. This is a strict repair attempt. Required: global must be an array of 5-7 objects with headline/body/sources; china must be an array; for_you must be an array; total_word_count must be a number. Errors: ${
        secondError instanceof Error ? secondError.message : String(secondError)
      }`
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
