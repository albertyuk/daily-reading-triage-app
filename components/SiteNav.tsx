export function SiteNav() {
  return (
    <nav className="mb-12 flex items-center gap-5 border-b border-rule pb-4 font-sans text-sm text-muted">
      <a href="/" className="text-ink no-underline">
        Today
      </a>
      <a href="/archive" className="no-underline">
        Archive
      </a>
      <a href="/lexicon" className="no-underline">
        Lexicon
      </a>
    </nav>
  );
}
