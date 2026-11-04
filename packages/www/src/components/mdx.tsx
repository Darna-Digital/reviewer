import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Step, Steps } from "fumadocs-ui/components/steps";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { Screenshot } from "#/components/screenshot";
import { usePrefersDark } from "#/hooks/use-prefers-dark";

/**
 * A screenshot that opens in the docs' lightbox on click. The page shows the
 * capture for the reader's scheme through <picture>; the lightbox is handed
 * the same one.
 */
function ZoomableScreenshot(props: ComponentProps<typeof Screenshot>) {
  const scheme = usePrefersDark() ? "dark" : "light";

  return (
    <ImageZoom
      alt={props.alt}
      height={props.height}
      src={`/screenshots/${props.name}-${scheme}.avif`}
      width={props.width}
    >
      <Screenshot {...props} />
    </ImageZoom>
  );
}

export function useMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Screenshot: ZoomableScreenshot,
    Step,
    Steps,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof useMDXComponents>;
}
