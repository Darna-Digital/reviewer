import { MacOSScrollAccel } from '@opentui/core';
import type { MouseEvent } from '@opentui/core';
import * as React from 'react';

/** Columns a sideways notch moves, before acceleration. */
const SIDEWAYS_STEP = 4;
/** A swipe keeps to the axis it started on for this long. */
const AXIS_LOCK_MS = 150;

type Axis = 'rows' | 'columns';

/**
 * Turns wheel events into whole rows (and columns, when `onColumns` is
 * given): one per notch when scrolling slowly, accelerating through a fling
 * as macOS does, with the fraction carried so a trackpad's stream of small
 * ticks moves line by line. A sideways swipe — or ⇧ with the wheel — scrolls
 * across, and a gesture stays on its axis so a swipe does not drift.
 */
export function useWheel(
  onRows: (rows: number) => void,
  onColumns?: (columns: number) => void,
) {
  const accel = React.useRef({
    rows: new MacOSScrollAccel(),
    columns: new MacOSScrollAccel(),
  });
  const carry = React.useRef(0);
  const lock = React.useRef<{ axis: Axis; at: number } | null>(null);

  return (event: MouseEvent) => {
    const { scroll } = event;
    if (!scroll) return;
    const { direction } = scroll;
    const across =
      direction === 'left' ||
      direction === 'right' ||
      (event.modifiers.shift && !!onColumns);
    if (across && !onColumns) return;
    const axis: Axis = across ? 'columns' : 'rows';
    const now = Date.now();
    const held = lock.current;
    if (held && held.axis !== axis && now - held.at < AXIS_LOCK_MS) return;
    lock.current = { axis, at: now };

    const sign = direction === 'down' || direction === 'right' ? 1 : -1;
    const speed = accel.current[axis].tick(now) * Math.max(1, scroll.delta);
    if (across) return onColumns!(sign * Math.round(speed * SIDEWAYS_STEP));

    if (Math.sign(carry.current) === -sign) carry.current = 0;
    carry.current += sign * speed;
    const rows = Math.trunc(carry.current);
    carry.current -= rows;
    if (rows !== 0) onRows(rows);
  };
}
