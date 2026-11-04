import { Screenshot, type ScreenshotCrop } from "#/components/screenshot";

/**
 * Display captures are encoded at half their Retina resolution, still more
 * pixels than the widest layout draws. The hero is scaled to nearly 2× its
 * widest container, and the close crops (diff layouts, branch picker, the
 * hero's phone crop) keep their native size.
 *
 * The terminal app's captures sit on a wallpaper, like the Mac app's.
 * `tui-palette` and `tui-themes` are still placeholders: headless renders
 * (packages/tui/scripts/snapshot.tsx) framed as a window with transparent
 * corners, drawn on the CSS `.noir` backdrop. Replace them with real
 * captures under the same names and drop them from PLACEHOLDERS.
 */
const SCREENSHOT_SIZES = {
  "split-diff": { width: 2560, height: 1477 },
  "diff-split": { width: 1772, height: 1290 },
  "diff-stacked": { width: 1772, height: 1290 },
  "agent-models": { width: 2492, height: 1564 },
  "comment-assign": { width: 2076, height: 1430 },
  "run-services": { width: 2456, height: 942 },
  "branch-picker": { width: 1470, height: 1326 },
  history: { width: 1854, height: 1192 },
  "find-symbol": { width: 2798, height: 1884 },
  "tui-hero": { width: 2560, height: 1358 },
  "tui-comment": { width: 2316, height: 1486 },
  "tui-unified": { width: 2316, height: 1486 },
  "tui-split": { width: 2316, height: 1486 },
  "tui-history": { width: 2316, height: 1486 },
  "tui-palette": { width: 2403, height: 1466 },
  "tui-themes": { width: 2403, height: 1466 },
} as const;

export type ScreenshotName = keyof typeof SCREENSHOT_SIZES;

const PLACEHOLDERS = new Set<ScreenshotName>(["tui-palette", "tui-themes"]);

export const HERO_PHONE_CROP: ScreenshotCrop = {
  name: "split-diff-mobile",
  width: 1060,
  height: 1232,
};

export function AppScreenshot({
  label,
  lazy = true,
  name,
  phone,
}: {
  label: string;
  lazy?: boolean;
  name: ScreenshotName;
  phone?: ScreenshotCrop;
}) {
  const screenshot = (
    <Screenshot
      alt={label}
      lazy={lazy}
      name={name}
      phone={phone}
      {...SCREENSHOT_SIZES[name]}
    />
  );
  if (!PLACEHOLDERS.has(name)) return screenshot;
  return (
    <div className="noir px-[5%] pt-[4.5%] pb-[5%]">
      <div className="overflow-hidden rounded-[1%/1.64%] shadow-[0_24px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)]">
        {screenshot}
      </div>
    </div>
  );
}
