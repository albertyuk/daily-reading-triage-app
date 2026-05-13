import { Resend } from "resend";
import type { NextRequest } from "next/server";
import { formatDateInET } from "@/lib/dates";
import { SourceArticleSchema, type CorpusBundle, type SourceArticle } from "@/lib/schema";
import { getStorage } from "@/lib/storage";
import { wordCount } from "@/lib/text";
import { canonicalizeUrl, stableArticleId } from "@/lib/urls";

type ResendInboundEvent = {
  type: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    text?: string;
    html?: string;
  };
};

type ReceivedEmailPayload = {
  id?: string;
  from?: string;
  subject?: string;
  created_at?: string;
  text?: string;
  html?: string;
  data?: {
    from?: string;
    subject?: string;
    created_at?: string;
    text?: string;
    html?: string;
  };
};

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectForwardedSource(from: string, subject: string): { source: string; author: string } {
  const input = `${from} ${subject}`.toLowerCase();
  if (input.includes("stratechery")) {
    return { source: "Stratechery", author: "Ben Thompson" };
  }
  if (input.includes("money stuff") || input.includes("matt levine") || input.includes("bloomberg")) {
    return { source: "Money Stuff", author: "Matt Levine" };
  }
  return { source: "Forwarded Newsletter", author: from || "Unknown" };
}

async function getReceivedEmail(emailId: string): Promise<ReceivedEmailPayload> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const receiving = (resend.emails as unknown as { receiving?: { get(id: string): Promise<ReceivedEmailPayload> } })
    .receiving;
  if (!receiving?.get) {
    throw new Error("Installed Resend SDK does not expose emails.receiving.get");
  }
  return receiving.get(emailId);
}

function articleFromEmail(event: ResendInboundEvent, email: ReceivedEmailPayload): SourceArticle {
  const data = email.data ?? email;
  const from = data.from ?? event.data?.from ?? "";
  const subject = data.subject ?? event.data?.subject ?? "Forwarded newsletter";
  const createdAt = data.created_at ?? event.data?.created_at ?? new Date().toISOString();
  const body = data.text ?? (data.html ? htmlToText(data.html) : event.data?.text ?? "");
  const { source, author } = detectForwardedSource(from, subject);
  const date = formatDateInET(new Date(createdAt));
  const url = canonicalizeUrl(`https://email.local/${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${email.id ?? event.data?.email_id ?? crypto.randomUUID()}`);

  return SourceArticleSchema.parse({
    id: stableArticleId(source, url),
    date,
    title: subject.trim(),
    author,
    source,
    url,
    published_at: new Date(createdAt).toISOString(),
    content: body.trim(),
    excerpt: body.trim().slice(0, 500),
    source_pool: "curated",
    source_type: "email_forward",
    word_count: wordCount(body),
    raw: {
      from,
      email_id: email.id ?? event.data?.email_id
    }
  });
}

function mergeEmailIntoCorpus(existing: CorpusBundle | null, article: SourceArticle): CorpusBundle {
  const corpus = existing ?? {
    date: article.date,
    curated: [],
    global: [],
    discovery: []
  };

  const alreadyPresent = corpus.curated.some((item) => item.id === article.id || item.title === article.title);
  if (!alreadyPresent) corpus.curated.push(article);
  corpus.curated.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return corpus;
}

export async function verifyResendWebhook(req: NextRequest): Promise<ResendInboundEvent> {
  const payload = await req.text();
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    throw new Error("Missing Resend webhook signature headers");
  }
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    throw new Error("RESEND_WEBHOOK_SECRET is not configured");
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  return resend.webhooks.verify({
    payload,
    headers: { id, timestamp, signature },
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET
  }) as ResendInboundEvent;
}

export async function processInboundEmailEvent(event: ResendInboundEvent): Promise<SourceArticle | null> {
  if (event.type !== "email.received" || !event.data?.email_id) return null;
  const email = await getReceivedEmail(event.data.email_id);
  const article = articleFromEmail(event, email);
  const storage = getStorage();
  const existing = await storage.getRawCorpus(article.date);
  const corpus = mergeEmailIntoCorpus(existing, article);
  await storage.saveRawCorpus(article.date, corpus);
  return article;
}
