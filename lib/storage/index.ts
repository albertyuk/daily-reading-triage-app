import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CorpusBundleSchema,
  LexiconEntrySchema,
  PublishedDigestEnvelopeSchema,
  type CorpusBundle,
  type LexiconEntry,
  type PublishedDigestEnvelope
} from "@/lib/schema";

export type StorageAdapter = {
  saveRawCorpus(date: string, corpus: CorpusBundle): Promise<void>;
  getRawCorpus(date: string): Promise<CorpusBundle | null>;
  saveDigest(date: string, envelope: PublishedDigestEnvelope): Promise<void>;
  getDigest(date: string): Promise<PublishedDigestEnvelope | null>;
  listDigests(): Promise<PublishedDigestEnvelope[]>;
  getLexicon(): Promise<LexiconEntry[]>;
  appendLexicon(entries: LexiconEntry[]): Promise<void>;
  getMarker(key: string): Promise<string | null>;
  setMarker(key: string, value: string): Promise<void>;
};

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filename: string, schema: { parse(value: unknown): T }): Promise<T | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, filename), "utf8");
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonFile(filename: string, value: unknown) {
  await ensureDataDir();
  await writeFile(path.join(DATA_DIR, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const localStorage: StorageAdapter = {
  async saveRawCorpus(date, corpus) {
    await writeJsonFile(`raw-${date}.json`, corpus);
  },

  async getRawCorpus(date) {
    return readJsonFile(`raw-${date}.json`, CorpusBundleSchema);
  },

  async saveDigest(date, envelope) {
    await writeJsonFile(`digest-${date}.json`, envelope);
  },

  async getDigest(date) {
    return readJsonFile(`digest-${date}.json`, PublishedDigestEnvelopeSchema);
  },

  async listDigests() {
    await ensureDataDir();
    const files = await readdir(DATA_DIR);
    const envelopes = await Promise.all(
      files
        .filter((file) => /^digest-\d{4}-\d{2}-\d{2}\.json$/.test(file))
        .map((file) => readJsonFile(file, PublishedDigestEnvelopeSchema))
    );
    return envelopes
      .filter((item): item is PublishedDigestEnvelope => Boolean(item))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getLexicon() {
    const schema = LexiconEntrySchema.array();
    return (await readJsonFile("lexicon.json", schema)) ?? [];
  },

  async appendLexicon(entries) {
    if (entries.length === 0) return;
    const existing = await this.getLexicon();
    const byKey = new Map<string, LexiconEntry>();
    for (const entry of [...existing, ...entries]) {
      byKey.set(`${entry.term.toLowerCase()}|${entry.url}`, entry);
    }
    await writeJsonFile(
      "lexicon.json",
      [...byKey.values()].sort((a, b) => a.term.localeCompare(b.term))
    );
  },

  async getMarker(key) {
    const schema = {} as { parse(value: unknown): Record<string, string> };
    schema.parse = (value) => (value && typeof value === "object" ? (value as Record<string, string>) : {});
    const markers = (await readJsonFile("markers.json", schema)) ?? {};
    return markers[key] ?? null;
  },

  async setMarker(key, value) {
    const schema = {} as { parse(value: unknown): Record<string, string> };
    schema.parse = (input) => (input && typeof input === "object" ? (input as Record<string, string>) : {});
    const markers = (await readJsonFile("markers.json", schema)) ?? {};
    markers[key] = value;
    await writeJsonFile("markers.json", markers);
  }
};

async function getKv() {
  const mod = await import("@vercel/kv");
  return mod.kv;
}

const kvStorage: StorageAdapter = {
  async saveRawCorpus(date, corpus) {
    const kv = await getKv();
    await kv.set(`raw:${date}`, corpus);
  },

  async getRawCorpus(date) {
    const kv = await getKv();
    const raw = await kv.get(`raw:${date}`);
    return raw ? CorpusBundleSchema.parse(raw) : null;
  },

  async saveDigest(date, envelope) {
    const kv = await getKv();
    await kv.set(`digest:${date}`, envelope);
    await kv.zadd("digest:index", { score: Date.parse(date), member: date });
  },

  async getDigest(date) {
    const kv = await getKv();
    const raw = await kv.get(`digest:${date}`);
    return raw ? PublishedDigestEnvelopeSchema.parse(raw) : null;
  },

  async listDigests() {
    const kv = await getKv();
    const dates = await kv.zrange<string>("digest:index", 0, 100, { rev: true });
    const digests = await Promise.all(dates.map((date) => this.getDigest(date)));
    return digests.filter((item): item is PublishedDigestEnvelope => Boolean(item));
  },

  async getLexicon() {
    const kv = await getKv();
    const raw = await kv.get("lexicon");
    return raw ? LexiconEntrySchema.array().parse(raw) : [];
  },

  async appendLexicon(entries) {
    if (entries.length === 0) return;
    const existing = await this.getLexicon();
    const byKey = new Map<string, LexiconEntry>();
    for (const entry of [...existing, ...entries]) {
      byKey.set(`${entry.term.toLowerCase()}|${entry.url}`, entry);
    }
    const merged = [...byKey.values()].sort((a, b) => a.term.localeCompare(b.term));
    const kv = await getKv();
    await kv.set("lexicon", merged);
  },

  async getMarker(key) {
    const kv = await getKv();
    return kv.get<string>(`marker:${key}`);
  },

  async setMarker(key, value) {
    const kv = await getKv();
    await kv.set(`marker:${key}`, value);
  }
};

export function getStorage(): StorageAdapter {
  if (process.env.KV_URL && process.env.KV_REST_API_TOKEN) {
    return kvStorage;
  }
  return localStorage;
}
