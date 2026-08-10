/**
 * The design-system kitchen sink — every token, control, and layout pattern on
 * one page so a change to the theme can be judged everywhere at once. Dev only;
 * the route drops it from production builds.
 */
import { useEffect, useState } from "react";
import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";

import { ComponentsGallery } from "@/components/kitchen-sink/components-gallery";
import { Foundations } from "@/components/kitchen-sink/foundations";
import { Patterns } from "@/components/kitchen-sink/patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cycleTheme, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "color", label: "Colour" },
  { id: "type", label: "Typography" },
  { id: "shape", label: "Shape" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "forms", label: "Forms" },
  { id: "nav", label: "Tabs" },
  { id: "overlays", label: "Overlays" },
  { id: "surfaces", label: "Surfaces" },
  { id: "data", label: "Data" },
  { id: "feedback", label: "Feedback" },
];

const THEME_ICON = {
  light: IconSun,
  dark: IconMoon,
  system: IconDeviceDesktop,
};

function useVisibleSection() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const onscreen = entries.filter((e) => e.isIntersecting);
        if (onscreen.length === 0) return;
        const topmost = onscreen.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        setActive(topmost.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" }
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el !== null) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return active;
}

function ThemeButton() {
  const { theme } = useUiPrefs();
  const Icon = THEME_ICON[theme];
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      aria-label={`Theme: ${theme}. Switch.`}
    >
      <Icon data-icon="inline-start" />
      {theme}
    </Button>
  );
}

export function KitchenSinkPage() {
  const active = useVisibleSection();

  return (
    <div className="isolate min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full bg-brand-500" />
            <p className="truncate text-base font-medium sm:text-sm">
              Byconvo design system
            </p>
            <Badge variant="ghost" className="max-sm:hidden">
              local dev only
            </Badge>
          </div>
          <ThemeButton />
        </div>
        <nav className="scroll-fade-x overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
          <ul role="list" className="flex w-max gap-1">
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    "flex rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                    active === id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto flex max-w-6xl gap-12 px-4 py-10 sm:px-6 lg:px-8">
        <nav className="sticky top-28 w-40 shrink-0 self-start max-lg:hidden">
          <ul role="list" className="flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    "flex rounded-xl px-3 py-1.5 text-sm",
                    active === id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-20">
          <div>
            <h1 className="max-w-[24ch] text-4xl font-semibold tracking-tight text-balance">
              Greyscale everywhere, blue only for what you have not seen
            </h1>
            <p className="mt-4 max-w-[56ch] text-base/7 text-pretty text-muted-foreground">
              Tight corners, hairline edges carried in the shadow rather than on
              a border, and actions that are black on white or white on black.
              The one saturated colour in the system is spent on a single dot
              that means something arrived — which is why a dot that small can
              carry it. Every value below is a token, so changing it once moves
              the whole app.
            </p>
          </div>

          <Foundations />
          <ComponentsGallery />
          <Patterns />
        </main>
      </div>
    </div>
  );
}
