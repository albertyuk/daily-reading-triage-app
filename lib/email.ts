import { render } from "@react-email/render";
import { Resend } from "resend";
import { DigestEmail } from "@/components/email/DigestEmail";
import { getTopHeadline } from "@/lib/publish";
import type { PublishedDigestEnvelope, VerificationIssue } from "@/lib/schema";

function emailReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.EMAIL_TO);
}

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendTextEmail(subject: string, text: string): Promise<void> {
  if (!emailReady()) {
    console.warn(`Email not sent; missing Resend configuration. Subject: ${subject}`);
    return;
  }

  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: [process.env.EMAIL_TO!],
    subject,
    text
  });
}

export async function sendDigestEmail(envelope: PublishedDigestEnvelope): Promise<void> {
  if (!emailReady()) {
    console.warn("Digest email not sent; missing Resend configuration.");
    return;
  }

  const subject = `Briefing — ${envelope.date} — ${getTopHeadline(envelope)}`;
  const html = await render(DigestEmail({ envelope, siteUrl: process.env.SITE_URL }));
  const text = await render(DigestEmail({ envelope, siteUrl: process.env.SITE_URL }), {
    plainText: true
  });

  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: [process.env.EMAIL_TO!],
    subject,
    html,
    text
  });
}

export async function sendFailureEmail(date: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await sendTextEmail(`Briefing failed — ${date}`, `Daily briefing failed for ${date}: ${message}`);
}

export async function sendAuditWarningEmail(
  date: string,
  failures: VerificationIssue[]
): Promise<void> {
  if (failures.length === 0) return;
  await sendTextEmail(
    `Briefing audit warning — ${date}`,
    [
      `Audit removed ${failures.length} failed item(s) for ${date}.`,
      "",
      ...failures.map((failure) => `- [${failure.section}] ${failure.issue}`)
    ].join("\n")
  );
}
