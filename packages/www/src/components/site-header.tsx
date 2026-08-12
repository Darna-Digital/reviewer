import { Logo } from "#/components/logo";

const NAV_LINKS = [
  { label: "Changelog", href: "/changelog" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="h-header border-b border-black/8 bg-white dark:border-white/10 dark:bg-neutral-950">
        <div className="mx-auto flex h-full max-w-[1248px] items-center gap-6 px-6">
          <a aria-label="byconvo home" className="flex shrink-0" href="/">
            <Logo className="h-7 w-auto" />
          </a>
          <nav
            aria-label="Site"
            className="ml-auto hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                className="flex h-7 items-center rounded-md px-2 text-sm whitespace-nowrap text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-white"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            className="ml-auto inline-flex h-8 shrink-0 items-center rounded-full bg-neutral-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900/90 md:ml-0 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            href="/download"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}
