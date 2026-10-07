import { MacOSScrollAccel } from '@opentui/core';
import type { MouseEvent } from '@opentui/core';
import * as React from 'react';

/**
 * Turns wheel events into whole rows: one per notch when scrolling slowly,
 * accelerating through a fling as macOS does, with the fraction carried so
 * a trackpad's stream of small ticks moves line by line.
 */
export function useWheel(onRows: (rows: number) => void) {
  const accel = React.useRef(new MacOSScrollAccel());
  const carry = React.useRef(0);
  return (event: MouseEvent) => {
    const scroll = event.scroll;
    if (!scroll || (scroll.direction !== 'up' && scroll.direction !== 'down'))
      return;
    const sign = scroll.direction === 'down' ? 1 : -1;
    if (Math.sign(carry.current) === -sign) carry.current = 0;
    carry.current += sign * Math.max(1, scroll.delta) * accel.current.tick();
    const rows = Math.trunc(carry.current);
    carry.current -= rows;
    if (rows !== 0) onRows(rows);
  };
}
