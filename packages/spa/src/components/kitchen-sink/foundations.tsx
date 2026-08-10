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
    role: "Notification indicators — unread, waiting, activity.",
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
  { token: "rounded-sm", radius: "rounded-sm", role: "4px — xs controls" },
  { token: "rounded-md", radius: "rounded-md", role: "6px — the default" },
  { token: "rounded-lg", radius: "rounded-lg", role: "8px — cards, sheets" },
  { token: "rounded-full", radius: "rounded-full", role: "Dots, avatars" },
];

/* The three faces every control is cut from, and the story each one tells.
   Kept in the sink because the difference is easy to lose in a diff: it is one
   gradient direction and one hairline apart. */
const FACES = [
  {
    token: "face-contrast",
    face: "face-contrast bg-primary text-primary-foreground",
    role: "The one filled action. Sheen, no ring.",
  },
  {
    token: "face-raised",
    face: "face-raised bg-button-neutral text-foreground",
    role: "Lifted off the page by a 0.5px ring and a drop.",
  },
  {
    token: "face-quiet",
    face: "face-quiet text-foreground",
    role: "Nothing until hovered. The overlay is the whole look.",
  },
];

const ELEVATIONS = [
  { token: "shadow-button", shadow: "shadow-button", role: "Raised controls" },
  { token: "shadow-raised", shadow: "shadow-raised", role: "Cards, comments" },
  { token: "shadow-floating", shadow: "shadow-floating", role: "Menus" },
  { token: "shadow-overlay", shadow: "shadow-overlay", role: "Dialogs" },
];

/* The interface scale — distinct from the display sizes above it. Two sizes and
   two weights cover every control in the app; the tracking flips sign between
   them because small type needs opening up where large type needs closing. */
const UI_TYPE = [
  { cls: "text-ui font-plus", token: "text-ui / font-plus (13 / 530)" },
  { cls: "text-ui font-book", token: "text-ui / font-book (13 / 440)" },
  {
    cls: "text-meta font-plus text-muted-foreground",
    token: "text-meta / font-plus (11 / 530)",
  },
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
      className={`h-14 w-full rounded-lg inset-ring inset-ring-foreground/10 ${swatch}`}
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
          hint="Anchored at 500 = #00a6f4 = oklch(0.692 0.16 240.4). 500 is the indicator dot, 700 is the accent as readable ink. The deep rungs carry less chroma than the ramp's shape suggests because sRGB runs out of blue down there."
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
          hint="Pure neutrals, chroma 0. The accent never washes into a surface — it only ever appears as a mark on one."
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

        <Subsection
          title="The accent in use"
          hint="One job: a dot that says something arrived and has not been seen. It is the only saturated thing on a screen of greys, which is the whole reason a 6px circle can carry that meaning at all. Every unread, waiting, and activity mark resolves through bg-brand-500 — never a raw Tailwind blue."
        >
          <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
            {[
              { dot: true, label: "Unread thread", meta: "chat, inbox" },
              { dot: true, label: "Agent waiting for input", meta: "window bar" },
              { dot: false, label: "Read, nothing pending", meta: "at rest" },
            ].map(({ dot, label, meta }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="grid size-4 shrink-0 place-items-center">
                  {dot && (
                    <span className="size-2 rounded-full bg-brand-500" />
                  )}
                </span>
                <p className="text-ui">{label}</p>
                <p className="text-meta font-plus text-muted-foreground">
                  {meta}
                </p>
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
          title="Interface scale"
          hint="What every control actually uses — separate from the display sizes above. Two sizes, two weights; 530 and 440 are variable-font positions between medium and regular, which is what keeps a dense toolbar from reading as bold."
        >
          <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4">
            {UI_TYPE.map(({ cls, token }) => (
              <div
                key={token}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
              >
                <p className={cls}>Rebase the branch onto master</p>
                <p className="font-mono text-sm text-muted-foreground sm:text-xs">
                  {token}
                </p>
              </div>
            ))}
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
        <Subsection
          title="Radius"
          hint="Tight. 6px is the default and 4px is for anything 24px tall; nothing between a control and a dialog is rounder than 8px."
        >
          <SpecimenRow>
            {RADII.map(({ token, radius, role }) => (
              <Specimen key={token} label={`${token} · ${role}`}>
                <div
                  className={`size-16 bg-muted inset-ring inset-ring-foreground/10 ${radius}`}
                />
              </Specimen>
            ))}
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Faces"
          hint="A raised face catches light on its top edge; an inset one catches it on the bottom, which is the only difference between a button and the switch's groove. Hover and press are a tint composited over whatever is already there, never a second background colour — so one pair of values covers every variant in both themes."
        >
          <SpecimenRow>
            {FACES.map(({ token, face, role }) => (
              <Specimen key={token} label={role}>
                <button
                  type="button"
                  className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-ui font-plus ${face}`}
                >
                  {token}
                </button>
              </Specimen>
            ))}
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Elevation"
          hint="A 0.5px hairline lives inside each shadow rather than on a border, so a control's box never grows by its edge. The filled button is the one exception — a ring around a saturated fill reads as a drawn border."
        >
          <SpecimenRow>
            {ELEVATIONS.map(({ token, shadow, role }) => (
              <Specimen key={token} label={`${token} · ${role}`}>
                <div className={`size-16 rounded-lg bg-card ${shadow}`} />
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
                className={`flex flex-col gap-1 rounded-lg p-4 ${surfaceClasses(level)}`}
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
