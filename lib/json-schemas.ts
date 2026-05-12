const urlString = { type: "string", format: "uri" } as const;

const triageItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    author: { type: "string" },
    source: { type: "string" },
    url: urlString,
    tier: { type: "string", enum: ["read_in_full", "worth_a_glance"] },
    text: { type: "string" },
    estimated_read_minutes: { anyOf: [{ type: "number" }, { type: "null" }] }
  },
  required: ["author", "source", "url", "tier", "text"]
} as const;

const themeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    synthesis: { type: "string" },
    underlying_pieces: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          author: { type: "string" },
          source: { type: "string" },
          url: urlString
        },
        required: ["author", "source", "url"]
      }
    }
  },
  required: ["name", "synthesis", "underlying_pieces"]
} as const;

const lexiconEntryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    term: { type: "string" },
    definition: { type: "string" },
    introduced_by: { type: "string" },
    source: { type: "string" },
    url: urlString
  },
  required: ["term", "definition", "introduced_by", "source", "url"]
} as const;

const globalItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    body: { type: "string" },
    sources: {
      type: "array",
      minItems: 1,
      items: urlString
    }
  },
  required: ["headline", "body", "sources"]
} as const;

const forYouItemJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    body: { type: "string" },
    why_for_you: { type: "string" },
    url: urlString,
    source: { type: "string" }
  },
  required: ["headline", "body", "why_for_you", "url", "source"]
} as const;

export const digestJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    reading_queue: {
      type: "object",
      additionalProperties: false,
      properties: {
        read_in_full: {
          type: "array",
          maxItems: 3,
          items: triageItemJsonSchema
        },
        worth_a_glance: {
          type: "array",
          maxItems: 10,
          items: triageItemJsonSchema
        },
        skipped_count: { type: "number" },
        skip_reason_summary: { type: "string" }
      },
      required: ["read_in_full", "worth_a_glance", "skipped_count", "skip_reason_summary"]
    },
    themes: {
      type: "array",
      maxItems: 3,
      items: themeJsonSchema
    },
    lexicon: {
      type: "array",
      maxItems: 5,
      items: lexiconEntryJsonSchema
    },
    global: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: globalItemJsonSchema
    },
    for_you: {
      type: "array",
      maxItems: 5,
      items: forYouItemJsonSchema
    },
    total_word_count: { type: "number" }
  },
  required: [
    "date",
    "reading_queue",
    "themes",
    "lexicon",
    "global",
    "for_you",
    "total_word_count"
  ]
} as const;

export const auditReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cleaned_digest: digestJsonSchema,
    verification_report: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: "string" },
          item_id: { anyOf: [{ type: "string" }, { type: "null" }] },
          issue: { type: "string" },
          severity: { type: "string", enum: ["fail", "warn"] }
        },
        required: ["section", "issue", "severity"]
      }
    },
    audit_provider: { type: "string" },
    audit_duration_ms: { type: "number" }
  },
  required: ["cleaned_digest", "verification_report", "audit_provider", "audit_duration_ms"]
} as const;
