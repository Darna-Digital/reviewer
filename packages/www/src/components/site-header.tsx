import { Logo } from "#/components/logo";
import { useScrolled } from "#/hooks/use-scrolled";

const NAV_LINKS = [
  { label: "Changelog", href: "/changelog" },
  { label: "Docs", href: "/docs" },
];

export function SiteHeader() {
  const scrolled = useScrolled();
  const backdrop = scrolled
    ? "border-black/8 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/80"
    : "border-transparent bg-transparent";
  const navTone = scrolled
    ? "text-neutral-700 dark:text-neutral-300"
    : "text-neutral-900 dark:text-neutral-100";

  return (
    <header className="sticky top-0 z-40 -mb-header">
      <div
        className={`h-header border-b transition-colors duration-200 ${backdrop}`}
      >
        <div className="mx-auto flex h-full max-w-[1248px] items-center gap-6 px-6">
          <a aria-label="reviewer home" className="flex shrink-0" href="/">
            <Logo className="h-7 w-auto" />
          </a>
          <nav
            aria-label="Site"
            className="ml-auto hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                className={`flex h-7 items-center rounded-md px-2 text-sm whitespace-nowrap transition-colors hover:bg-black/5 hover:text-neutral-900 dark:hover:bg-white/8 dark:hover:text-white ${navTone}`}
                href={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            className="ml-auto inline-flex h-8 shrink-0 items-center rounded-full bg-neutral-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900/90 md:ml-0 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            href="/app"
          >
            Open app
          </a>
        </div>
      </div>
    </header>
  );
}
