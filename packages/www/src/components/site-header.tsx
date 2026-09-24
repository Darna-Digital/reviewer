import { Apple, GitHub } from "#/components/icons";
import { Logo } from "#/components/logo";
import { DOWNLOAD_URL, REPO_URL } from "#/lib/links";

const NAV_LINK =
  "inline-flex items-center gap-1.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white";

export function SiteHeader() {
  return (
    <header className="relative z-40 -mb-header h-header">
      <div className="mx-auto flex h-full max-w-[1008px] items-center gap-5 px-6">
        <a href="/">
          <Logo className="h-5 w-auto" />
        </a>
        <a
          className={`ml-auto ${NAV_LINK}`}
          href={REPO_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHub className="size-4" />
          GitHub
        </a>
        <a className={NAV_LINK} href={DOWNLOAD_URL}>
          <Apple className="size-4" />
          Download
        </a>
      </div>
    </header>
  );
}
