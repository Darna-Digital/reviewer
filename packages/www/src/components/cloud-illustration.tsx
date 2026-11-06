import { useSyncExternalStore } from "react";

import { Asciify } from "#/components/asciify/Asciify";

const LIGHT = "(prefers-color-scheme: light)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(LIGHT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Reviewer Cloud has no screenshot yet, so its stage shows a photo of cloud
 * banks, baby blue in light mode and black in dark mode, redrawn by
 * canvasui's Asciify. The paper behind the glyphs is the photo's own sky
 * colour, so only the clouds turn into characters. The pointer's lens is a
 * window onto the photo underneath. It overhangs its frame by a few pixels,
 * because Asciify leaves a sliver of the photo bare along its edges.
 */
export function CloudIllustration() {
  // White cloud is only a little brighter than a baby-blue sky, so light mode
  // stretches the difference; otherwise its clouds come out as faint dots.
  const light = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(LIGHT).matches,
    () => false
  );
  return (
    <Asciify
      aberration={0}
      background="auto"
      backgroundOpacity={1}
      baseStrength={1}
      brightness={light ? 0.8 : 0}
      className="-m-1 aspect-[2560/1358] w-[calc(100%+0.5rem)] bg-[#a2d1f8] dark:bg-[#090909]"
      contrast={light ? 2.5 : 1}
      reveal={1}
      scale={2.5}
    >
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet="/cloud/sky-dark.avif"
        />
        <img
          alt="Banks of cloud drawn in characters across the sky"
          className="block size-full object-cover"
          height={848}
          src="/cloud/sky-light.avif"
          width={1600}
        />
      </picture>
    </Asciify>
  );
}
