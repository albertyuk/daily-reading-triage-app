import { z } from "zod";

export const SourcePoolSchema = z.enum(["curated", "global", "discovery"]);
export const SourceTypeSchema = z.enum(["free_rss", "email_forward", "scrape"]);

export function noDuplicateBody(value: string): boolean {
  const sentences = value.match(/[^.!?]+[.!?]+/g) ?? [value];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, " ");
    if (normalized.length > 30 && seen.has(normalized)) return false;
    seen.add(normalized);
  }
  return true;
}

export const SourceArticleSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  author: z.string(),
  source: z.string(),
  url: z.string().url(),
  published_at: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  source_pool: SourcePoolSchema,
  source_type: SourceTypeSchema,
  word_count: z.number(),
  raw: z.unknown().optional()
});

export const CorpusBundleSchema = z.object({
  date: z.string(),
  curated: z.array(SourceArticleSchema),
  global: z.array(SourceArticleSchema),
  discovery: z.array(SourceArticleSchema)
});

export const TriageItemSchema = z.object({
  author: z.string(),
  source: z.string(),
  url: z.string().url(),
  tier: z.enum(["read_in_full", "worth_a_glance"]),
  text: z.string().refine(noDuplicateBody, "Text contains duplicate sentences"),
  _reasoning: z.string().max(280).optional(),
  estimated_read_minutes: z.number().nullable().optional()
});

export const ThemeSchema = z.object({
  name: z.string(),
  synthesis: z.string().max(400),
  _reasoning: z.string().max(280).optional(),
  underlying_pieces: z
    .array(
      z.object({
        author: z.string(),
        source: z.string(),
        url: z.string().url()
      })
    )
    .min(2)
});

export const LexiconEntrySchema = z.object({
  term: z.string(),
  definition: z.string().max(200),
  introduced_by: z.string(),
  source: z.string(),
  url: z.string().url(),
  _reasoning: z.string().max(280).optional()
});

export const GlobalItemSchema = z.object({
  headline: z.string(),
  body: z.string().refine(noDuplicateBody, "Body contains duplicate sentences"),
  sources: z.array(z.string().url()).min(1),
  _reasoning: z.string().max(280).optional()
});

export const ForYouItemSchema = z.object({
  headline: z.string(),
  body: z.string().refine(noDuplicateBody, "Body contains duplicate sentences"),
  why_for_you: z.string().max(120),
  url: z.string().url(),
  source: z.string(),
  _reasoning: z.string().max(280).optional()
});

export const SkipLogEntrySchema = z.object({
  article_url: z.string().url(),
  source: z.string(),
  reason: z.string().max(200)
});

export const DigestSchema = z.object({
  date: z.string(),
  reading_queue: z.object({
    read_in_full: z.array(TriageItemSchema).max(3),
    worth_a_glance: z.array(TriageItemSchema).min(0).max(10),
    skipped_count: z.number(),
    skip_reason_summary: z.string().max(120)
  }),
  themes: z.array(ThemeSchema).max(3),
  lexicon: z.array(LexiconEntrySchema).max(5),
  global: z.array(GlobalItemSchema).min(5).max(7),
  for_you: z.array(ForYouItemSchema).min(0).max(5),
  _skip_log: z.array(SkipLogEntrySchema).default([]),
  total_word_count: z.number()
});

export const VerificationIssueSchema = z.object({
  section: z.string(),
  item_id: z.string().nullable().optional(),
  issue: z.string(),
  severity: z.enum(["fail", "warn"])
});

export const AuditReportSchema = z.object({
  cleaned_digest: DigestSchema,
  verification_report: z.array(VerificationIssueSchema),
  audit_provider: z.string(),
  audit_duration_ms: z.number()
});

export const RunStatsSchema = z.object({
  date: z.string(),
  curated_count: z.number(),
  global_count: z.number(),
  discovery_count: z.number(),
  synthesis_curated_count: z.number().default(0),
  synthesis_global_count: z.number().default(0),
  synthesis_discovery_count: z.number().default(0),
  synthesis_input_chars: z.number().default(0),
  read_in_full_count: z.number(),
  worth_a_glance_count: z.number(),
  skipped_count: z.number(),
  theme_count: z.number(),
  lexicon_count: z.number(),
  for_you_count: z.number(),
  word_count: z.number(),
  audit_fail_count: z.number(),
  audit_warn_count: z.number(),
  audit_provider: z.string(),
  synthesis_provider: z.string().default("anthropic/claude-opus-4-7"),
  llm_cost_usd: z.number().default(0),
  llm_calls: z.number().default(0),
  audit_duration_ms: z.number(),
  run_duration_ms: z.number()
});

export const RunLogEntrySchema = z.object({
  stage: z.enum(["synthesis", "audit"]),
  label: z.string(),
  detail: z.string(),
  model: z.string().optional()
});

export const ArticleDecisionSchema = z.object({
  article_id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.string().url(),
  pool: z.enum(["curated", "global", "discovery", "china"]),
  decision: z.string(),
  rationale: z.string()
});

export const RunLogSchema = z.object({
  synthesis: z.array(RunLogEntrySchema).default([]),
  audit: z.array(RunLogEntrySchema).default([]),
  article_decisions: z.array(ArticleDecisionSchema).default([])
});

export const PublishedDigestEnvelopeSchema = z.object({
  date: z.string(),
  digest: DigestSchema,
  synthesis_provider: z.string().default("anthropic/claude-opus-4-7"),
  audit_provider: z.string(),
  audit_duration_ms: z.number(),
  verification_report: z.array(VerificationIssueSchema),
  run_log: RunLogSchema.default({
    synthesis: [],
    audit: [],
    article_decisions: []
  }),
  stats: RunStatsSchema,
  published_at: z.string()
});

export type SourcePool = z.infer<typeof SourcePoolSchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type SourceArticle = z.infer<typeof SourceArticleSchema>;
export type CorpusBundle = z.infer<typeof CorpusBundleSchema>;
export type TriageItem = z.infer<typeof TriageItemSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type LexiconEntry = z.infer<typeof LexiconEntrySchema>;
export type GlobalItem = z.infer<typeof GlobalItemSchema>;
export type ForYouItem = z.infer<typeof ForYouItemSchema>;
export type Digest = z.infer<typeof DigestSchema>;
export type VerificationIssue = z.infer<typeof VerificationIssueSchema>;
export type AuditReport = z.infer<typeof AuditReportSchema>;
export type RunStats = z.infer<typeof RunStatsSchema>;
export type RunLogEntry = z.infer<typeof RunLogEntrySchema>;
export type ArticleDecision = z.infer<typeof ArticleDecisionSchema>;
export type RunLog = z.infer<typeof RunLogSchema>;
export type PublishedDigestEnvelope = z.infer<typeof PublishedDigestEnvelopeSchema>;

export function flattenCorpus(corpus: CorpusBundle): SourceArticle[] {
  return [...corpus.curated, ...corpus.global, ...corpus.discovery];
}
