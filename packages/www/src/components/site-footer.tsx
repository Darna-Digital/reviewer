import { Container } from "#/components/feature-section";
import { Logo } from "#/components/logo";

const FOOTER_LINKS = [
  { label: "Changelog", href: "/changelog" },
  { label: "Docs", href: "/docs" },
  { label: "Download", href: "/download" },
];

export function SiteFooter() {
  return (
    <footer className="w-full overflow-hidden bg-gradient-to-b from-neutral-100 to-white dark:from-neutral-900 dark:to-neutral-950">
      <Container className="relative">
        <div className="absolute top-0 left-1/2 h-px w-screen -translate-x-1/2 bg-black/8 dark:bg-white/10" />
        <div className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
          <a aria-label="reviewer home" className="flex shrink-0" href="/">
            <Logo className="h-6 w-auto" />
          </a>
          <nav aria-label="Footer" className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <a
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            © 2026 Darna Digital. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
