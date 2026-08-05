import {
  Section,
  Specimen,
  SpecimenRow,
  Subsection,
} from "@/components/kitchen-sink/kitchen-sink-primitives";
import { surfaceClasses } from "@/lib/surface-classes";

const BRAND_RAMP = [
  { step: "50", swatch: "bg-brand-50" },
  { step: "100", swatch: "bg-brand-100" },
  { step: "200", swatch: "bg-brand-200" },
  { step: "300", swatch: "bg-brand-300" },
  { step: "400", swatch: "bg-brand-400" },
  { step: "500", swatch: "bg-brand-500" },
  { step: "600", swatch: "bg-brand-600" },
  { step: "700", swatch: "bg-brand-700" },
  { step: "800", swatch: "bg-brand-800" },
  { step: "900", swatch: "bg-brand-900" },
  { step: "950", swatch: "bg-brand-950" },
];

const ROLE_TOKENS = [
  {
    token: "primary",
    swatch: "bg-primary",
    role: "The one filled action. Neutral, never the accent.",
  },
  {
    token: "brand-500",
    swatch: "bg-brand-500",
    role: "Small accents only — filter dots, links, status marks.",
  },
  {
    token: "accent",
    swatch: "bg-accent",
    role: "Selected rows and menu highlights (gray)",
  },
  {
    token: "success",
    swatch: "bg-success",
    role: "Passed checks, merged work",
  },
  {
    token: "warning",
    swatch: "bg-warning",
    role: "Needs attention, not broken",
  },
  {
    token: "destructive",
    swatch: "bg-destructive",
    role: "Failures and irreversible actions",
  },
];

const SURFACE_TOKENS = [
  { token: "background", swatch: "bg-background", role: "The page itself" },
  { token: "card", swatch: "bg-card", role: "Raised, standalone content" },
  { token: "muted", swatch: "bg-muted", role: "Recessed wells, hover states" },
  { token: "input", swatch: "bg-input", role: "Field fills" },
  { token: "border", swatch: "bg-border", role: "Hairlines and dividers" },
];

const INK_TOKENS = [
  { token: "text-foreground", ink: "text-foreground" },
  { token: "text-muted-foreground", ink: "text-muted-foreground" },
  { token: "text-link", ink: "text-link" },
  { token: "text-destructive", ink: "text-destructive" },
];

const RADII = [
  { token: "rounded-md", radius: "rounded-md" },
  { token: "rounded-lg", radius: "rounded-lg" },
  { token: "rounded-xl", radius: "rounded-xl" },
  { token: "rounded-2xl", radius: "rounded-2xl" },
  { token: "rounded-3xl", radius: "rounded-3xl" },
  { token: "rounded-full", radius: "rounded-full" },
];

const SURFACE_LADDER = [
  { level: 1, role: "Page, sidebar" },
  { level: 2, role: "Cards" },
  { level: 3, role: "Menu, popover, select" },
  { level: 4, role: "Tooltip" },
  { level: 5, role: "Dialog; submenu of a menu" },
  { level: 6, role: "Tooltip over a menu" },
  { level: 7, role: "Menu inside a dialog" },
  { level: 8, role: "Ceiling — deeper nesting clamps here" },
];

function SwatchTile({ swatch }: { swatch: string }) {
  return (
    <div
      className={`h-14 w-full rounded-2xl inset-ring inset-ring-foreground/10 ${swatch}`}
    />
  );
}

export function Foundations() {
  return (
    <>
      <Section
        id="color"
        title="Colour"
        description="Actions are neutral — near-black on white, near-white on dark. Exactly one hue exists alongside them, a baby blue that marks what is focused, selected, or live."
      >
        <Subsection
          title="Accent ramp"
          hint="Anchored at 500 = oklch(0.69 0.16 265.2). The pale rungs are surfaces, 500 is the accent mark, 700 is the accent as readable ink."
        >
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-11">
            {BRAND_RAMP.map(({ step, swatch }) => (
              <Specimen key={step} label={step}>
                <SwatchTile swatch={swatch} />
              </Specimen>
            ))}
          </div>
        </Subsection>

        <Subsection
          title="Roles"
          hint="Never reach for a ramp step directly in product code — reach for the role."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {ROLE_TOKENS.map(({ token, swatch, role }) => (
              <div key={token} className="flex min-w-0 flex-col gap-2">
                <SwatchTile swatch={swatch} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate font-mono text-sm sm:text-xs">
                    {token}
                  </p>
                  <p className="text-sm/5 text-pretty text-muted-foreground sm:text-xs/5">
                    {role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Subsection>

        <Subsection
          title="Surfaces"
          hint="Neutrals carry a trace of the accent hue so greys never look muddy beside it."
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {SURFACE_TOKENS.map(({ token, swatch, role }) => (
              <div key={token} className="flex min-w-0 flex-col gap-2">
                <SwatchTile swatch={swatch} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate font-mono text-sm sm:text-xs">
                    {token}
                  </p>
                  <p className="text-sm/5 text-pretty text-muted-foreground sm:text-xs/5">
                    {role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Subsection>

        <Subsection title="Ink">
          <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
            {INK_TOKENS.map(({ token, ink }) => (
              <div
                key={token}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
              >
                <p className={`text-base/7 sm:text-sm/6 ${ink}`}>
                  Rebase the branch onto master
                </p>
                <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                  {token}
                </p>
              </div>
            ))}
          </div>
        </Subsection>
      </Section>

      <Section
        id="type"
        title="Typography"
        description="Inter throughout, with the character alternates switched on. Semibold is the heaviest weight the system uses — bold reads shouty at this scale."
      >
        <Subsection title="Scale">
          <div className="flex flex-col divide-y divide-foreground/10">
            <div className="flex flex-col gap-1 pb-5">
              <h3 className="max-w-[30ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                What should we work on?
              </h3>
              <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                text-4xl sm:text-5xl / font-semibold / tracking-tight
              </p>
            </div>
            <div className="flex flex-col gap-1 py-5">
              <h3 className="max-w-[35ch] text-2xl font-semibold tracking-tight text-balance">
                Review comments
              </h3>
              <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                text-2xl / font-semibold / tracking-tight
              </p>
            </div>
            <div className="flex flex-col gap-1 py-5">
              <h3 className="text-base font-medium">Section heading</h3>
              <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                text-base / font-medium
              </p>
            </div>
            <div className="flex flex-col gap-1 py-5">
              <p className="max-w-[56ch] text-base/7 text-pretty sm:text-sm/6">
                Body copy sits at sixteen pixels on a phone and drops to
                fourteen from the small breakpoint up, so a line never gets
                harder to read as the screen gets smaller.
              </p>
              <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                text-base/7 sm:text-sm/6
              </p>
            </div>
            <div className="flex flex-col gap-1 pt-5">
              <p className="text-sm text-muted-foreground sm:text-xs">
                Supporting label, timestamps, counts
              </p>
              <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                text-sm sm:text-xs / text-muted-foreground
              </p>
            </div>
          </div>
        </Subsection>

        <Subsection
          title="Numerals"
          hint="Anything that ticks gets tabular figures so the layout holds still."
        >
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Specimen label="tabular-nums">
              <p className="text-2xl tabular-nums">1,408 · 09:41 · 12.5%</p>
            </Specimen>
            <Specimen label="default">
              <p className="text-2xl">1,408 · 09:41 · 12.5%</p>
            </Specimen>
          </div>
        </Subsection>
      </Section>

      <Section
        id="shape"
        title="Shape and elevation"
        description="Corners are generous and depth is a ladder, not a shadow preset. Every popup lifts a fixed number of rungs above whatever it opened on, so a submenu still reads over its menu and a menu still reads inside a dialog."
      >
        <Subsection title="Radius">
          <SpecimenRow>
            {RADII.map(({ token, radius }) => (
              <Specimen key={token} label={token}>
                <div
                  className={`size-16 bg-brand-100 inset-ring inset-ring-brand-300 ${radius}`}
                />
              </Specimen>
            ))}
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Surfaces"
          hint="Light separates layers with shadow, dark with colour — a black drop shadow says nothing against a dark page. Components ask for an offset, never a level: menu +2, tooltip +3, dialog +4, counted from the surface they landed on."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SURFACE_LADDER.map(({ level, role }) => (
              <div
                key={level}
                className={`flex flex-col gap-1 rounded-2xl p-4 ${surfaceClasses(level)}`}
              >
                <p className="font-mono text-sm sm:text-xs">surface-{level}</p>
                <p className="text-sm/5 text-pretty text-muted-foreground sm:text-xs/5">
                  {role}
                </p>
              </div>
            ))}
          </div>
        </Subsection>
      </Section>
    </>
  );
}
