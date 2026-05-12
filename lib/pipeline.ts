import { auditDigest } from "@/lib/audit";
import { formatDateInET } from "@/lib/dates";
import { sendAuditWarningEmail, sendFailureEmail } from "@/lib/email";
import { flattenCorpus } from "@/lib/schema";
import { ingestAll } from "@/lib/ingest";
import { publish } from "@/lib/publish";
import { synthesize } from "@/lib/synthesize";

export async function runDailyPipeline(date = formatDateInET()) {
  const t0 = Date.now();

  try {
    const corpus = await ingestAll(date);
    const draft = await synthesize(corpus);
    const audit = await auditDigest(draft, flattenCorpus(corpus));

    const failures = audit.verification_report.filter((item) => item.severity === "fail");
    const warnings = audit.verification_report.filter((item) => item.severity === "warn");
    console.log(
      `Audit: ${failures.length} fails, ${warnings.length} warnings, ${audit.audit_duration_ms}ms via ${audit.audit_provider}`
    );

    if (failures.length > 0) {
      await sendAuditWarningEmail(date, failures);
    }

    return publish(date, audit, corpus, t0);
  } catch (error) {
    await sendFailureEmail(date, error);
    throw error;
  }
}
