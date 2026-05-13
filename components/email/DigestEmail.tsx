import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text
} from "@react-email/components";
import type { PublishedDigestEnvelope } from "@/lib/schema";
import { publicationFromUrl } from "@/lib/source-names";

const styles = {
  body: {
    backgroundColor: "#fbfaf7",
    color: "#1d1d1f",
    fontFamily: "Georgia, Cambria, serif",
    fontSize: "17px",
    lineHeight: "1.65"
  },
  container: {
    maxWidth: "680px",
    margin: "0 auto",
    padding: "32px 20px"
  },
  eyebrow: {
    color: "#6f6a63",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
    letterSpacing: "1.2px",
    textTransform: "uppercase" as const
  },
  h1: {
    fontWeight: 400,
    fontSize: "34px",
    lineHeight: "1.2",
    margin: "0 0 12px"
  },
  h2: {
    fontFamily: "Arial, sans-serif",
    fontSize: "14px",
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
    margin: "36px 0 10px"
  },
  h3: {
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
    margin: "18px 0 4px"
  },
  muted: {
    color: "#6f6a63",
    fontFamily: "Arial, sans-serif",
    fontSize: "13px"
  },
  link: {
    color: "#2f6f73"
  }
};

function MarkdownEmailText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!match) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <Link key={`${match[2]}-${index}`} href={match[2]} style={styles.link}>
            {match[1]}
          </Link>
        );
      })}
    </>
  );
}

export function DigestEmail({
  envelope,
  siteUrl
}: {
  envelope: PublishedDigestEnvelope;
  siteUrl?: string;
}) {
  const digest = envelope.digest;
  const preview =
    digest.global[0]?.headline ??
    digest.reading_queue.read_in_full[0]?.source ??
    "Daily Reading Triage";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.eyebrow}>Daily Reading Triage</Text>
          <Heading style={styles.h1}>{digest.date}</Heading>
          <Text style={styles.muted}>
            {digest.total_word_count} words. Synthesis via {envelope.synthesis_provider}. Audit via{" "}
            {envelope.audit_provider}.
            {siteUrl ? (
              <>
                {" "}
                <Link href={`${siteUrl}/${digest.date}`} style={styles.link}>
                  Open archive
                </Link>
              </>
            ) : null}
          </Text>
          <Hr />

          <Section>
            <Heading as="h2" style={styles.h2}>
              Today&apos;s Reading Queue
            </Heading>
            <Text style={styles.muted}>
              {digest.reading_queue.skipped_count} skipped: {digest.reading_queue.skip_reason_summary}
            </Text>
            {digest.reading_queue.read_in_full.map((item) => (
              <Text key={item.url}>
                <strong>{item.source}</strong> by {item.author}. {item.text}{" "}
                <Link href={item.url} style={styles.link}>
                  Read
                </Link>
              </Text>
            ))}
            {digest.reading_queue.worth_a_glance.map((item) => (
              <Text key={item.url}>
                <strong>{item.source}</strong> by {item.author}. {item.text}{" "}
                <Link href={item.url} style={styles.link}>
                  Read
                </Link>
              </Text>
            ))}
          </Section>

          <Section>
            <Heading as="h2" style={styles.h2}>
              Cross-Cutting Themes
            </Heading>
            {digest.themes.length === 0 ? <Text style={styles.muted}>No clear convergence today.</Text> : null}
            {digest.themes.map((theme) => (
              <Text key={theme.name}>
                <strong>{theme.name}.</strong> {theme.synthesis}
              </Text>
            ))}
          </Section>

          <Section>
            <Heading as="h2" style={styles.h2}>
              New In The Lexicon
            </Heading>
            {digest.lexicon.length === 0 ? <Text style={styles.muted}>No durable terms today.</Text> : null}
            {digest.lexicon.map((entry) => (
              <Text key={`${entry.term}-${entry.url}`}>
                <strong>{entry.term}.</strong> {entry.definition}{" "}
                <Link href={entry.url} style={styles.link}>
                  {entry.source}
                </Link>
              </Text>
            ))}
          </Section>

          <Section>
            <Heading as="h2" style={styles.h2}>
              Global Briefing
            </Heading>
            {digest.global.map((item) => (
              <Text key={item.headline}>
                <strong>{item.headline}.</strong> <MarkdownEmailText text={item.body} />{" "}
                {item.sources.map((source, index) => (
                  <Link key={source} href={source} style={styles.link}>
                    {index > 0 ? `, ${publicationFromUrl(source) ?? `Source ${index + 1}`}` : publicationFromUrl(source) ?? "Source"}
                  </Link>
                ))}
              </Text>
            ))}
          </Section>

          <Section>
            <Heading as="h2" style={styles.h2}>
              For You
            </Heading>
            {digest.for_you.length === 0 ? (
              <Text style={styles.muted}>No discovery item cleared the bar today.</Text>
            ) : null}
            {digest.for_you.map((item) => (
              <Text key={item.url}>
                <strong>{item.headline}.</strong> <MarkdownEmailText text={item.body} />{" "}
                <Link href={item.url} style={styles.link}>
                  {item.source}
                </Link>
                <br />
                <span style={styles.muted}>{item.why_for_you}</span>
              </Text>
            ))}
          </Section>

          <Hr />
          <Text style={styles.muted}>
            This run: {digest.total_word_count} words · ${envelope.stats.llm_cost_usd.toFixed(4)} in LLM
            cost · {envelope.stats.synthesis_input_chars} synthesis input chars ·{" "}
            {envelope.stats.audit_fail_count} audit failures
            {siteUrl ? (
              <>
                {" "}
                <Link href={`${siteUrl}/runs/${digest.date}`} style={styles.link}>
                  Full trace
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
