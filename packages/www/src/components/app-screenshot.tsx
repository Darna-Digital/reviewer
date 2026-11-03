import { Screenshot, type ScreenshotCrop } from "#/components/screenshot";

/**
 * Display captures are encoded at half their Retina resolution, still more
 * pixels than the widest layout draws. The hero is scaled to nearly 2× its
 * widest container, and the close crops (diff layouts, branch picker, the
 * hero's phone crop) keep their native size.
 *
 * The `tui-` captures are placeholders: headless renders of the terminal app
 * (packages/tui/scripts/snapshot.tsx) on a demo repository, framed as a
 * terminal window. Replace them with real screenshots under the same names
 * and sizes.
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
  "tui-review": { width: 2659, height: 1714 },
  "tui-split": { width: 2659, height: 1714 },
  "tui-palette": { width: 2659, height: 1714 },
  "tui-history": { width: 2659, height: 1714 },
  "tui-themes": { width: 2659, height: 1714 },
} as const;

export type ScreenshotName = keyof typeof SCREENSHOT_SIZES;

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
  return (
    <Screenshot
      alt={label}
      lazy={lazy}
      name={name}
      phone={phone}
      {...SCREENSHOT_SIZES[name]}
    />
  );
}
