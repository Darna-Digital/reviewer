import * as React from 'react';

const DOUBLE_CLICK_MS = 400;

/** Returns a checker: `true` when `key` was also the previous click, just now. */
export function useDoubleClick() {
  const last = React.useRef<{ key: string; at: number } | null>(null);
  return React.useCallback((key: string) => {
    const now = Date.now();
    const isDouble =
      last.current?.key === key && now - last.current.at < DOUBLE_CLICK_MS;
    last.current = isDouble ? null : { key, at: now };
    return isDouble;
  }, []);
}
