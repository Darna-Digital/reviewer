import { GitHub } from "#/components/icons";
import { Logo } from "#/components/logo";
import { GITHUB_URL } from "#/lib/links";
import { useScrolled } from "#/hooks/use-scrolled";

export function SiteHeader() {
  const scrolled = useScrolled();
  const backdrop = scrolled
    ? "border-black/8 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/80"
    : "border-transparent bg-transparent";

  return (
    <header className="sticky top-0 z-40 -mb-header">
      <div
        className={`h-header border-b transition-colors duration-200 ${backdrop}`}
      >
        <div className="mx-auto flex h-full max-w-[1248px] items-center gap-6 px-6">
          <Logo className="h-7 w-auto shrink-0" />
          <a
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900/90 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            href={GITHUB_URL}
          >
            <GitHub className="size-4" />
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
