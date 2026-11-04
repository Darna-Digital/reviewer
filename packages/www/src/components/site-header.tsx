import { Link, useLoaderData, useMatch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Container } from "#/components/container";
import {
  ArrowUpRight,
  ChevronDown,
  Close,
  GitHub,
  Menu,
} from "#/components/icons";
import { Logo } from "#/components/logo";
import { useScrolled } from "#/hooks/use-scrolled";
import { cn } from "#/lib/cn";
import { formatStars } from "#/lib/github-stars";
import { RELEASES_URL, REPO_URL } from "#/lib/links";

function TouchTarget() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
    />
  );
}

const NAV_LINK =
  "relative inline-flex items-center gap-1.5 text-sm sm:text-[13px] lg:text-[15px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white";

const ACTIVE_LINK = { className: "text-neutral-900 dark:text-white" };

type MenuItem = {
  title: string;
  badge?: string;
  /** Shown only where the header hides its own link. */
  mobileOnly?: boolean;
} & (
  | {
      to: "/mac" | "/terminal" | "/cloud" | "/docs/$" | "/changelog" | "/about";
    }
  | { href: string }
);

const MENU: { heading: string; items: MenuItem[] }[] = [
  {
    heading: "Applications",
    items: [
      { to: "/mac", title: "Mac app" },
      { to: "/terminal", title: "Terminal app" },
      { to: "/cloud", title: "Reviewer Cloud", badge: "Waitlist" },
    ],
  },
  {
    heading: "Resources",
    items: [
      { to: "/about", title: "About" },
      { to: "/docs/$", title: "Docs", mobileOnly: true },
      { to: "/changelog", title: "Changelog", mobileOnly: true },
      { href: REPO_URL, title: "Source code" },
      { href: RELEASES_URL, title: "Releases" },
    ],
  },
];

const MENU_LINK =
  "inline-flex items-center gap-1.5 py-1 text-[15px] whitespace-nowrap font-medium text-neutral-900 transition-colors hover:text-neutral-500 dark:text-white dark:hover:text-neutral-400";

/**
 * A full-width panel under the header, as devin.ai lays out its menus. It
 * opens on hover with a mouse and on tap with a finger; Escape or a click
 * outside closes it.
 */
function ProductMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hover = (entering: boolean) => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    hovering.current = entering;
    setOpen(entering);
  };
  const close = () => setOpen(false);

  return (
    // Spans the header's full height so the pointer can reach the panel.
    <div
      className="flex self-stretch"
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      ref={root}
    >
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(NAV_LINK, open && "text-neutral-900 dark:text-white")}
        onClick={() => setOpen((was) => hovering.current || !was)}
        type="button"
      >
        <TouchTarget />
        {/* On phones the same panel is the whole site menu, behind a
            hamburger at the right of the header. */}
        <span className="sm:hidden">
          <span className="sr-only">Menu</span>
          {open ? (
            <Close className="size-6 text-neutral-900 dark:text-white" />
          ) : (
            <Menu className="size-6 text-neutral-900 dark:text-white" />
          )}
        </span>
        <span className="max-sm:hidden">Product</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200 max-sm:hidden",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "fixed inset-x-0 top-header z-50 border-b border-black/[0.06] bg-white shadow-[0_24px_48px_-28px_rgba(0,0,0,0.25)] transition duration-150 ease-out dark:border-white/[0.08] dark:bg-[#111113] dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.8)]",
          open ? "visible opacity-100" : "invisible opacity-0"
        )}
      >
        <Container
          className={cn(
            "grid gap-x-6 gap-y-6 pt-6 pb-8 transition-transform duration-200 ease-out sm:grid-cols-3 sm:gap-y-8 sm:pt-7 sm:pb-9 lg:grid-cols-4",
            open ? "translate-y-0" : "-translate-y-1"
          )}
        >
          {MENU.map(({ heading, items }) => (
            <div className="flex flex-col items-start gap-1" key={heading}>
              <p className="mb-2 text-[13px] text-neutral-500 dark:text-neutral-400">
                {heading}
              </p>
              {items.map((item) =>
                "to" in item ? (
                  <Link
                    className={cn(MENU_LINK, item.mobileOnly && "sm:hidden")}
                    key={item.title}
                    onClick={close}
                    to={item.to}
                  >
                    {item.title}
                    {item.badge && (
                      <span className="rounded-full bg-black/[0.05] px-1.5 py-px text-[11px] font-medium text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ) : (
                  <a
                    className={MENU_LINK}
                    href={item.href}
                    key={item.title}
                    onClick={close}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.title}
                    <ArrowUpRight className="size-3.5 text-neutral-400" />
                  </a>
                )
              )}
            </div>
          ))}
        </Container>
      </div>
    </div>
  );
}

/**
 * The GitHub mark and the star count as plain muted text, as e2b.dev shows
 * it. The count is fetched on the server and cached; without it the link
 * reads GitHub.
 */
function GitHubStars() {
  const { stars } = useLoaderData({ from: "__root__" });

  return (
    <a
      aria-label={
        stars === null
          ? "Reviewer on GitHub"
          : `${stars.toLocaleString("en-US")} GitHub stars on Darna-Digital/reviewer`
      }
      className={cn(NAV_LINK, "tabular-nums max-sm:hidden")}
      href={REPO_URL}
      rel="noopener noreferrer"
      target="_blank"
    >
      <GitHub className="size-4 lg:size-4.5" />
      {stars === null ? "GitHub" : formatStars(stars)}
    </a>
  );
}

export function SiteHeader() {
  const scrolled = useScrolled();
  // The docs keep the header solid and in the flow, with the sidebar under it,
  // as conductor.build/docs does; on a phone the docs' own bar replaces it.
  const docs = useMatch({ from: "/docs/$", shouldThrow: false }) !== undefined;
  const backdrop =
    scrolled || docs
      ? "border-black/[0.06] bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111113]/75"
      : "border-transparent bg-transparent";
  // While the Product menu is open, the header and its panel read as one sheet.
  const menuOpen =
    "has-[[aria-expanded=true]]:border-transparent has-[[aria-expanded=true]]:bg-white has-[[aria-expanded=true]]:backdrop-blur-none dark:has-[[aria-expanded=true]]:bg-[#111113]";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-header border-b transition-colors duration-200",
        docs ? "max-md:hidden" : "-mb-header",
        backdrop,
        menuOpen
      )}
    >
      <Container className="flex h-full items-center gap-5 lg:gap-7">
        <Link aria-label="Reviewer home" className="sm:mr-2" to="/">
          <Logo className="h-4 w-auto lg:h-[18px]" />
        </Link>
        <nav className="flex items-center gap-5 self-stretch max-sm:order-last sm:mr-auto lg:gap-7">
          <ProductMenu />
          <Link
            activeProps={ACTIVE_LINK}
            className={cn(NAV_LINK, "max-sm:hidden")}
            to="/docs/$"
          >
            Docs
          </Link>
          <Link
            activeProps={ACTIVE_LINK}
            className={cn(NAV_LINK, "max-sm:hidden")}
            to="/changelog"
          >
            Changelog
          </Link>
        </nav>
        <GitHubStars />
        <Link
          className="relative inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 max-sm:ml-auto lg:h-9 lg:px-4 lg:text-sm dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          to="/download"
        >
          <TouchTarget />
          Download
        </Link>
      </Container>
    </header>
  );
}
