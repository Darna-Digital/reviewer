const NAV_LINKS = [
  { label: "Changelog", href: "/changelog" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="h-header border-b border-black/10 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-4 md:px-8">
          <a aria-label="byconvo home" className="flex shrink-0" href="/">
            <img
              className="h-7 w-auto"
              src="/byconvo-logo-horizontal-black.svg"
              alt=""
              width={1233}
              height={315}
            />
          </a>
          <nav
            aria-label="Site"
            className="ml-auto hidden items-center gap-6 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                className="text-sm whitespace-nowrap text-neutral-600 transition-colors hover:text-neutral-900"
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            className="ml-auto inline-flex h-8 shrink-0 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white transition-colors hover:bg-neutral-900/90 md:ml-0"
            href="/download"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}
