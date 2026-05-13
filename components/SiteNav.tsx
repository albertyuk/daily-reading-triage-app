import { ThemeToggle } from "./ThemeToggle";
import { formatDateInET } from "@/lib/dates";

export function SiteNav() {
  const today = formatDateInET();

  return (
    <nav className="mb-12 flex items-center gap-5 border-b border-rule pb-4 font-sans text-sm text-muted">
      <div className="flex items-center gap-5">
        <a href="/" className="text-ink no-underline">
          Today
        </a>
        <a href="/archive" className="no-underline">
          Archive
        </a>
        <a href="/lexicon" className="no-underline">
          Lexicon
        </a>
        <a href={`/runs/${today}`} className="no-underline">
          Run Log
        </a>
      </div>
      <ThemeToggle />
    </nav>
  );
}
