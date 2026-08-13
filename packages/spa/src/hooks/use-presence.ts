import { useEffect, useState } from "react";

/**
 * Keeps content mounted for as long as its leaving transition runs, so a panel
 * animates out instead of vanishing the moment it is closed.
 */
export function usePresence(open: boolean, exitMs: number): boolean {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return open || present;
}

/**
 * True from the frame after `open`. Content mounted already in its open state
 * has nothing to transition from, so it is rendered closed and opened once the
 * browser has seen it there.
 */
export function useEntered(open: boolean): boolean {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);

  return entered;
}
