import Anthropic from "@anthropic-ai/sdk";
import { digestJsonSchema } from "@/lib/json-schemas";
import { DigestSchema, type CorpusBundle, type Digest, type GlobalItem, type SourceArticle } from "@/lib/schema";
import { interestProfile } from "@/lib/interest-profile";
import { parseJsonObject } from "@/lib/json";
import { logLLMCall } from "@/lib/observability/token-log";
import { getStorage } from "@/lib/storage";
import { clusterGlobalArticles, type StoryCluster } from "@/lib/synthesize/cluster";
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
2. GLOBAL_CORPUS_CLUSTERS — global articles pre-grouped by underlying story
3. DISCOVERY_CORPUS — broader source pool to filter for personalization, including China-focused business, technology, and social-media signals
4. INTEREST_PROFILE — the reader's interests, context, and what to surface or avoid

For CURATED_CORPUS, triage every piece into:

- read_in_full (max 3 per day, target 1-2 when curated material exists): piece is so good, dense, or important that any summary
  destroys value. The bar is high but not asymptotic — if a piece in the curated corpus has a clear thesis, original framing, or non-obvious analysis, it earns this tier.

- worth_a_glance (target 5-8 per day): piece has a real insight that compresses to 30-50
  words without significant loss. Surface the insight with attribution and link.
  If the curated corpus has 5+ items today, you should normally produce at least 3 worth_a_glance items. The triage is fine-grained, not gatekeeping.

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
- From GLOBAL_CORPUS_CLUSTERS, select 5-7 clusters with broadest impact today.
- Each cluster represents one underlying event covered by one or more outlets. Treat one cluster as ONE item.
- Per item: clear headline + 60-90 word paraphrase + inline source link(s).
- Prefer synthesizing across 2+ sources when the cluster has multiple member articles.
- Use 1 source when only 1 source covers the event; do not force multi-source synthesis by importing unrelated context.
- Surface conflicts between sources explicitly when present, e.g. "AP reports X; BBC emphasizes Y."
- A common failure mode is producing multiple items for the same underlying story when different outlets give it different framings. Do not do this. One cluster = one item, even if the outlets disagree.
- Every sentence must be supported by at least one URL in that item's sources array.
- Diversify sources. When GLOBAL_CORPUS_CLUSTERS contain 4+ source organizations, the final global section should normally use at least 4 distinct source organizations, and no single outlet should dominate.
- Prioritize stories that teach the reader about geopolitics, macroeconomics, markets, technology, institutions, public health, climate, war, migration, elections, trade, regulation, or major corporate strategy.
- Omit isolated local crime, celebrity lawsuits, routine court cases, oddities, weather incidents, sports recaps, and human-interest pieces unless they clearly reveal a larger system-level trend.
- A story should answer: "What does this teach a sharp reader about how the world works today?"
- Dry, factual tone.
- Do not include single-source rumors or speculation.

FOR YOU:
- From DISCOVERY_CORPUS, select 3-5 items that match INTEREST_PROFILE.
- Per item: headline + 40-60 word paraphrase + one phrase identifying which profile 
  element this matches + link.
- Only surface clear interest-profile matches. Generic items do not qualify.
- De-prioritize discovery items that closely overlap with anything in the curated queue.
- Do not invent quotes or catchy framings. Keep all quoted text out of this section.
- China-related business, policy, technology, and social-media items belong here when they match the reader's profile and are not globally important enough for Global Briefing.

ATTRIBUTION RENDERING:
- When referring to a source in body text, use markdown link syntax with the publication name: "[Reuters](url) reports..." or "per [the Guardian](url)."
- Do not use generic phrases like numbered source labels or "one outlet." Always name the publication.
- The sources array still contains all URLs for audit and end-of-item link lists.

VOICE:
- Smart, dry, declarative. Zero hype words.
- One idea per sentence. No throat-clearing.
- Closer to The Generalist or Money Stuff than Morning Brew.
- Avoid press-release prose. Phrases like "raises tens of millions and launches X, a platform gaining traction with..." are PR copy, not analysis.
- Avoid generic accolades: "groundbreaking," "leading," "innovative," "cutting-edge."
- The body should explain what happened, why it matters, and what the implication is.
- Good pattern: "The thing happened. The interesting part is X. The implication is Y."
- Bad pattern: "Company launches its groundbreaking platform, gaining strong traction with users."

OBSERVABILITY:
- For every item you emit, populate _reasoning with a brief max-2-sentence explanation of why you selected it.
- For tier choices, explain why this tier and not another.
- For global and for_you selection, explain why this story over alternatives.
- For lexicon entries, explain why the concept is durable rather than a one-off.
- For every curated article you skip, add an entry to _skip_log with the article_url, source, and specific reason.

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

function extendedThinkingEnabled(): boolean {
  if (process.env.ENABLE_EXTENDED_THINKING === "true") return true;
  if (process.env.ENABLE_EXTENDED_THINKING === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

function thinkingMarkdown(response: { content: AnthropicContentBlock[] }): string {
  return response.content
    .filter((block) => block.type === "thinking" && block.text)
    .map((block) => block.text)
    .join("\n\n---\n\n")
    .trim();
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
  _skip_log: { article_url, source, reason }[],
  total_word_count: number
}

TriageItem: { author, source, url, tier: "read_in_full" | "worth_a_glance", text, _reasoning, estimated_read_minutes? }
Theme: { name, synthesis, _reasoning, underlying_pieces: [{ author, source, url }] }
LexiconEntry: { term, definition, introduced_by, source, url, _reasoning }
GlobalItem: { headline, body, sources: string[], _reasoning }
ForYouItem: { headline, body, why_for_you, url, source, _reasoning }
`;
}

function compactCluster(cluster: StoryCluster): StoryCluster {
  return {
    ...cluster,
    member_articles: cluster.member_articles.map(compactArticle)
  };
}

function buildSynthesisUserMessage(corpus: CorpusBundle, extraInstruction?: string): string {
  const compacted = compactCorpus(corpus);
  const globalClusters = clusterGlobalArticles(compacted.global).map(compactCluster);
  return JSON.stringify(
    {
      CURATED_CORPUS: compacted.curated,
      GLOBAL_CORPUS_CLUSTERS: globalClusters,
      DISCOVERY_CORPUS: compacted.discovery,
      INTEREST_PROFILE: interestProfile,
      DIGEST_DATE: corpus.date,
      DIGEST_SCHEMA: schemaNote(),
      STRICT_SHAPE_REQUIREMENTS:
        "Top-level date MUST equal DIGEST_DATE. Top-level reading_queue MUST be an object. Top-level global MUST be an array of 5-7 GlobalItem objects. Top-level for_you MUST be an array, even when empty. Top-level _skip_log MUST be an array, even when empty. total_word_count MUST be a number; it may be approximate because the server recomputes it.",
      QUALITY_REQUIREMENTS:
        "If DISCOVERY_CORPUS has at least 10 items, for_you should normally contain 3-5 clear matches to the interest profile. Global items should select distinct story clusters; never create multiple global items from one cluster. Cite 2+ sources when cluster coverage overlaps; otherwise cite one source and stay inside it. Use at least 4 distinct global source organizations when available. Omit low-value local crime, celebrity, entertainment, sports, oddity, and human-interest stories unless they reveal a major structural trend. Return empty arrays only when there are truly no credible matches. Do not use internal phrases such as schema repair in user-visible text. Avoid quotation marks and unsupported outside comparisons.",
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

  // The pipeline date is a server-side fact, not something the model should decide.
  draft.date = corpus.date;

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

  draft.for_you = tryParseJsonString(draft.for_you);
  if (!Array.isArray(draft.for_you)) {
    draft.for_you = [];
  }

  draft._skip_log = tryParseJsonString(draft._skip_log);
  if (!Array.isArray(draft._skip_log)) {
    draft._skip_log = [];
  }

  if (typeof draft.total_word_count !== "number") {
    draft.total_word_count = 0;
  }

  return draft;
}

export function finalizeDigestCandidate(candidate: unknown, corpus: CorpusBundle): Digest {
  const coerced = coerceDigestCandidate(candidate, corpus);
  return DigestSchema.parse(normalizeDigest(DigestSchema.parse(coerced)));
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

  if (hasLowValueBriefingItem(digest.global)) {
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
  )}. Rebuild the digest from the source corpus. Keep read_in_full selective but remember the triage is fine-grained, not gatekeeping. If the only curated item is weak, it may be skipped, but write a normal reader-facing skip reason and include it in _skip_log. Include 5-7 global items and 3-5 for_you items when they clearly match the interest profile. Cluster global stories across sources only when sources cover the same event. Cite 2+ sources when coverage overlaps; otherwise cite one source and stay inside it. Use at least 4 distinct global sources when available. Omit local crime, celebrity lawsuits, entertainment disputes, sports, oddities, and isolated human-interest items unless they reveal a larger system-level trend. Remove quotation marks and outside comparisons. Target at least 900 words on sparse curated days.`;
}

async function callClaudeForDigest(corpus: CorpusBundle, extraInstruction?: string): Promise<Digest> {
  const t0 = Date.now();
  const thinkingEnabled = extendedThinkingEnabled();
  const response = await getAnthropic().messages.create({
    model: getSynthesisModel(),
    max_tokens: thinkingEnabled ? 16000 : 8000,
    ...(thinkingEnabled
      ? { thinking: { type: "enabled" as const, budget_tokens: Number(process.env.EXTENDED_THINKING_BUDGET ?? 8000) } }
      : {}),
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
  } as Parameters<ReturnType<typeof getAnthropic>["messages"]["create"]>[0]);

  const responseWithUsage = response as typeof response & {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    _request_id?: string;
  };
  const thinking = thinkingMarkdown(response as { content: AnthropicContentBlock[] });
  await logLLMCall(corpus.date, {
    stage: "synthesis",
    model: getSynthesisModel(),
    input_tokens: responseWithUsage.usage?.input_tokens ?? 0,
    output_tokens: responseWithUsage.usage?.output_tokens ?? 0,
    thinking_tokens: thinking ? estimateTokenCount(thinking) : 0,
    cached_tokens:
      (responseWithUsage.usage?.cache_creation_input_tokens ?? 0) +
      (responseWithUsage.usage?.cache_read_input_tokens ?? 0),
    duration_ms: Date.now() - t0,
    request_id: responseWithUsage._request_id
  });

  if (thinking) {
    await getStorage().saveRunArtifact(corpus.date, "synthesis-thinking.md", thinking);
  }

  const digest = finalizeDigestCandidate(
    extractStructuredOutput(response as { content: AnthropicContentBlock[]; stop_reason?: string | null }, DIGEST_TOOL_NAME),
    corpus
  );
  await getStorage().saveRunArtifact(corpus.date, "synthesis-output.json", digest);
  return digest;
}

function dateFromDraftOrCorpus(draft: unknown, corpus: SourceArticle[]): string {
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    const date = (draft as { date?: unknown }).date;
    if (typeof date === "string" && date.trim()) return date;
  }
  return corpus.find((article) => article.date)?.date ?? new Date().toISOString().slice(0, 10);
}

function bundleFromSourceArticles(corpus: SourceArticle[], date: string): CorpusBundle {
  return {
    date,
    curated: corpus.filter((article) => article.source_pool === "curated"),
    global: corpus.filter((article) => article.source_pool === "global"),
    discovery: corpus.filter((article) => article.source_pool === "discovery")
  };
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
      }. Correct the STRUCTURE, not just wording. Return a tool input where global is an array, for_you is an array, _skip_log is an array, and total_word_count is a number.`
    );
  } catch (secondError) {
    return await callClaudeForDigest(
      corpus,
      `The last two responses failed validation. This is a strict repair attempt. Required: global must be an array of 5-7 objects with headline/body/sources; for_you must be an array; _skip_log must be an array; total_word_count must be a number. Errors: ${
        secondError instanceof Error ? secondError.message : String(secondError)
      }`
    );
  }
}

export async function repairDigestForAudit(
  draft: unknown,
  corpus: SourceArticle[],
  validationIssue: string,
  date = dateFromDraftOrCorpus(draft, corpus)
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
  return finalizeDigestCandidate(parsed, bundleFromSourceArticles(corpus, date));
}
