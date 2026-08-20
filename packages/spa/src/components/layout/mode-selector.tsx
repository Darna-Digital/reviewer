/**
 * ModeSelector — the modes, as a strip of tabs at the head of the window bar.
 *
 * It used to be a chip that dropped a menu: one press to be told which modes
 * there are, a second to change. There are two of them, and which one you are
 * in is the frame around everything else on the bar — so they are drawn as what
 * they are, a tab each, wearing the same chip as the window's own tabs beside
 * them. Links rather than buttons: a mode is a place, and its tab says so on
 * hover and answers a modified click like every other link in the app.
 *
 * One chord covers the lot. ⌘G moves to the next mode along and wraps, so there
 * is one thing to learn however many modes there come to be; the tab it would
 * take you to is the one whose tooltip shows the keycaps.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { TooltipTrigger } from "@/components/ui/tooltip";
import { TAB_STRIP, tabChipClass } from "@/components/layout/tab-chip";
import { BarTooltip, NO_DRAG } from "@/components/layout/window-bar.chrome";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import {
  activeWorkMode,
  nextWorkMode,
  workModeTabs,
  type WorkModeTab,
} from "@/lib/work-mode";

const MODE_KEYS = "⌘G";

/** Remember the pick, so the frame still reads right after a reload. */
const remember = (mode: WorkModeTab) => setUiPrefs({ workMode: mode.mode });

/**
 * Which mode the strip is on, and the one ⌘G would move to — read the same way
 * by the tabs and by the bar that answers the chord.
 */
function useWorkModes() {
  const { workMode } = useUiPrefs();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const modes = workModeTabs();
  const active = activeWorkMode(pathname, workMode);
  return { modes, active, next: nextWorkMode(modes, active) };
}

/**
 * Take the window to the next mode. Handed to the window bar, which owns the
 * chords the bar answers — the switch itself belongs with the tabs.
 */
export function useModeCycle(): () => void {
  const { next } = useWorkModes();
  const navigate = useNavigate();
  return () => {
    if (next === null) return;
    remember(next);
    void navigate({ to: next.to });
  };
}

export function ModeSelector() {
  const { modes, active, next } = useWorkModes();

  // A strip of one tab is no choice at all: with collaboration switched off the
  // app has a single frame, and naming it takes room from the tabs that do move
  // the window somewhere.
  if (modes.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Modes"
      className={cn(TAB_STRIP, "shrink-0", NO_DRAG)}
    >
      {modes.map((mode) => {
        const selected = mode.mode === active;
        return (
          <BarTooltip
            key={mode.mode}
            label={selected ? mode.detail : `Switch to ${mode.title}`}
            keys={mode.mode === next?.mode ? MODE_KEYS : null}
          >
            <TooltipTrigger
              render={
                <Link
                  to={mode.to}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => remember(mode)}
                  // The window's own tabs, less the slot they keep for a ✕:
                  // nothing is ever closed from here, so the chip is even
                  // either side of its name.
                  className={cn(tabChipClass(selected), "px-2.5 font-medium")}
                />
              }
            >
              <span className="truncate">{mode.title}</span>
            </TooltipTrigger>
          </BarTooltip>
        );
      })}
    </div>
  );
}
