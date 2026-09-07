import { GitHub } from "#/components/icons";
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
          <div className="flex items-baseline gap-1.5">
            <a
              className="text-lg leading-[20px] font-semibold text-neutral-950 transition-colors hover:text-neutral-950/80 dark:text-white dark:hover:text-white/80"
              href="/"
            >
              Reviewer
            </a>
            <span className="hidden text-sm leading-[20px] text-neutral-500 md:inline dark:text-neutral-400">
              by{" "}
              <a
                className="text-neutral-500 transition-colors hover:text-neutral-950/80 dark:text-neutral-400 dark:hover:text-white/80"
                href="https://darnadigital.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                Darna Digital
              </a>
            </span>
          </div>
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
