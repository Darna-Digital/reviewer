import { Link, useMatch } from "@tanstack/react-router";

import { BlockWordmark } from "#/components/block-wordmark";
import { Container } from "#/components/container";
import { cn } from "#/lib/cn";
import { ISSUES_URL, RELEASES_URL, REPO_URL } from "#/lib/links";

const LINK =
  "text-[15px] text-neutral-500 transition-colors hover:text-neutral-900 lg:text-base dark:text-neutral-400 dark:hover:text-white";

type FooterLink =
  | {
      label: string;
      to:
        "/mac" | "/terminal" | "/cloud" | "/download" | "/changelog" | "/about";
    }
  | { label: string; href: string };

const COLUMNS: Array<{ title: string; links: Array<FooterLink> }> = [
  {
    title: "Product",
    links: [
      { label: "Mac app", to: "/mac" },
      { label: "Terminal app", to: "/terminal" },
      { label: "Reviewer Cloud", to: "/cloud" },
      { label: "Download", to: "/download" },
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
      { label: "About", to: "/about" },
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
  const docs = useMatch({ from: "/docs/$", shouldThrow: false }) !== undefined;
  return (
    <footer
      className={cn(
        "overflow-hidden border-t border-black/[0.06] pt-12 sm:pt-20 dark:border-white/[0.08]",
        // The docs' sidebar rule runs down to the footer, so no gap above it.
        !docs && "mt-24 sm:mt-36"
      )}
    >
      <Container>
        <div className="grid gap-x-6 gap-y-10 max-sm:grid-cols-2 sm:grid-cols-3 sm:gap-x-8">
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
