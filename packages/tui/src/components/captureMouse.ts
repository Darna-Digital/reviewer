import type { CliRenderer, Renderable } from '@opentui/core';

/**
 * Routes the rest of a drag to `target`. OpenTUI otherwise captures whatever
 * is under the pointer on the first drag event; when a resize re-renders that
 * element away, the drag goes nowhere. `setCapturedRenderable` is private in
 * 0.5's typings, hence the cast.
 */
export function captureMouse(renderer: CliRenderer, target: Renderable | null) {
  if (!target) return;
  (
    renderer as unknown as { setCapturedRenderable: (r: Renderable) => void }
  ).setCapturedRenderable(target);
}
