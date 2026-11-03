import { Link, useLoaderData } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Container } from "#/components/container";
import {
  Apple,
  ChevronDown,
  Cloud,
  GitHub,
  Laptop,
  Terminal,
} from "#/components/icons";
import { Logo } from "#/components/logo";
import { useScrolled } from "#/hooks/use-scrolled";
import { cn } from "#/lib/cn";
import { formatStars } from "#/lib/github-stars";
import { DOWNLOAD_URL, REPO_URL } from "#/lib/links";

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

const PRODUCTS = [
  {
    to: "/mac",
    title: "Mac app",
    description: "Read, comment and hand off in one window.",
    icon: Laptop,
    badge: null,
  },
  {
    to: "/terminal",
    title: "Terminal app",
    description: "The same review, from the keyboard.",
    icon: Terminal,
    badge: null,
  },
  {
    to: "/cloud",
    title: "Reviewer Cloud",
    description: "Our paid service. Join the waitlist.",
    icon: Cloud,
    badge: "Waitlist",
  },
] as const;

/**
 * Opens on hover with a mouse and on tap with a finger; Escape or a click
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

  return (
    <div
      className="relative"
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
        Product
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "z-50 transition duration-150 ease-out max-sm:fixed max-sm:inset-x-4 max-sm:top-header sm:absolute sm:top-full sm:-left-3 sm:pt-3",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0"
        )}
      >
        <div className="flex flex-col rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] sm:w-[340px] dark:bg-[#1c1c1f] dark:ring-white/[0.08]">
          {PRODUCTS.map(({ to, title, description, icon: Icon, badge }) => (
            <Link
              className="group flex items-center gap-3.5 rounded-xl p-3 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              key={to}
              onClick={() => setOpen(false)}
              to={to}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-black/[0.04] text-neutral-600 ring-1 ring-black/[0.05] ring-inset dark:bg-white/[0.06] dark:text-neutral-300 dark:ring-white/[0.06]">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900 dark:text-white">
                  {title}
                  {badge && (
                    <span className="rounded-full bg-black/[0.05] px-1.5 py-px text-[11px] font-medium text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-400">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-[13px] text-neutral-500 dark:text-neutral-400">
                  {description}
                </span>
              </span>
            </Link>
          ))}
          <Link
            className="mt-1 border-t border-black/[0.06] px-3 pt-3 pb-2 text-[15px] font-medium text-neutral-600 sm:hidden dark:border-white/[0.08] dark:text-neutral-300"
            onClick={() => setOpen(false)}
            to="/changelog"
          >
            Changelog
          </Link>
        </div>
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
  const backdrop = scrolled
    ? "border-black/[0.06] bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111113]/75"
    : "border-transparent bg-transparent";

  return (
    <header
      className={`sticky top-0 z-40 -mb-header h-header border-b transition-colors duration-200 ${backdrop}`}
    >
      <Container className="flex h-full items-center gap-5 lg:gap-7">
        <Link aria-label="Reviewer home" className="sm:mr-2" to="/">
          <Logo className="h-4 w-auto lg:h-[18px]" />
        </Link>
        <nav className="mr-auto flex items-center gap-5 lg:gap-7">
          <ProductMenu />
          <Link
            activeProps={ACTIVE_LINK}
            className={cn(NAV_LINK, "max-sm:hidden")}
            to="/changelog"
          >
            Changelog
          </Link>
        </nav>
        <GitHubStars />
        <a
          className="relative inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-neutral-700 lg:h-9 lg:px-4 lg:text-sm dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          href={DOWNLOAD_URL}
        >
          <TouchTarget />
          <Apple className="size-3.5 lg:size-4" />
          Download
        </a>
      </Container>
    </header>
  );
}
