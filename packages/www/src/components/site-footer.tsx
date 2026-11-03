import { Link } from "@tanstack/react-router";

import { BlockWordmark } from "#/components/block-wordmark";
import { Container } from "#/components/container";
import { GitHub } from "#/components/icons";
import { DOWNLOAD_URL, ISSUES_URL, RELEASES_URL, REPO_URL } from "#/lib/links";

const LINK =
  "text-[15px] text-neutral-500 transition-colors hover:text-neutral-900 lg:text-base dark:text-neutral-400 dark:hover:text-white";

type FooterLink =
  | { label: string; to: "/mac" | "/terminal" | "/cloud" | "/changelog" }
  | { label: string; href: string };

const COLUMNS: Array<{ title: string; links: Array<FooterLink> }> = [
  {
    title: "Product",
    links: [
      { label: "Mac app", to: "/mac" },
      { label: "Terminal app", to: "/terminal" },
      { label: "Reviewer Cloud", to: "/cloud" },
      { label: "Download for Mac", href: DOWNLOAD_URL },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Changelog", to: "/changelog" },
      { label: "Releases", href: RELEASES_URL },
      { label: "Report an issue", href: ISSUES_URL },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source code", href: REPO_URL },
      { label: "License", href: `${REPO_URL}/blob/main/LICENSE` },
      { label: "Security", href: `${REPO_URL}/blob/main/SECURITY.md` },
    ],
  },
];

function FooterAnchor({ link }: { link: FooterLink }) {
  if ("to" in link) {
    return (
      <Link className={LINK} to={link.to}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      className={LINK}
      href={link.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {link.label}
    </a>
  );
}

/**
 * Columns of links, then the name in the mark's blocks across the full width,
 * resting on the bottom edge of the page.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 overflow-hidden border-t border-black/[0.06] pt-12 sm:mt-36 sm:pt-20 dark:border-white/[0.08]">
      <Container>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-[1.4fr_repeat(3,1fr)] sm:gap-x-8">
          <div className="col-span-2 flex flex-col gap-5 sm:col-span-1">
            <p className="max-w-xs text-[15px] leading-relaxed text-pretty text-neutral-500 lg:text-base dark:text-neutral-400">
              The Mac app and the terminal app are free and open source.
              Reviewer Cloud will be paid. Made by{" "}
              <a
                className="text-neutral-700 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                href="https://darnadigital.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                Darna Digital
              </a>
              .
            </p>
            <a
              aria-label="Reviewer on GitHub"
              className="w-fit text-neutral-400 transition-colors hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white"
              href={REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <GitHub className="size-6" />
            </a>
          </div>
          {COLUMNS.map((column) => (
            <div className="flex flex-col gap-3" key={column.title}>
              <p className="text-[13px] font-semibold text-neutral-900 lg:text-sm dark:text-white">
                {column.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterAnchor link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-neutral-400 sm:mt-20 dark:text-neutral-500">
          © {new Date().getFullYear()} Darna Digital
        </p>

        <BlockWordmark className="mt-6 text-neutral-200 sm:mt-10 dark:text-neutral-800" />
      </Container>
    </footer>
  );
}
