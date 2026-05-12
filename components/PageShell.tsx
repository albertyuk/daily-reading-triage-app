import { SiteNav } from "./SiteNav";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[680px] px-5 py-8 sm:px-6 sm:py-12">
      <SiteNav />
      {children}
    </main>
  );
}
