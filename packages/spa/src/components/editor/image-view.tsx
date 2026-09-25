/**
 * ImageView — an image file rendered rather than parsed. SVGs get the WebStorm
 * treatment: source on the left, the rendered image on the right.
 */
import { useState } from "react";
import { CodeView } from "@/components/editor/code-view";
import { OpenFailed } from "@/components/editor/open-failed";
import { UnsupportedFile } from "@/components/editor/unsupported-file";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Orb } from "@/components/ui/orb";
import { useFileBytes } from "@/lib/queries";
import { setUiPrefs, useUiPrefs, type Theme } from "@/lib/ui-prefs";

const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "bmp",
  "ico",
  "svg",
];

const extensionOf = (path: string) =>
  path.split(".").at(-1)?.toLowerCase() ?? "";

export const isImagePath = (path: string) =>
  IMAGE_EXTENSIONS.includes(extensionOf(path));

export const isSvgPath = (path: string) => extensionOf(path) === "svg";

function Preview({ path }: { path: string }) {
  const bytes = useFileBytes(path);
  const [natural, setNatural] = useState<string | null>(null);
  const [undecodable, setUndecodable] = useState(false);

  if (undecodable) return <UnsupportedFile path={path} />;
  if (bytes.isPending) {
    return (
      <div className="grid h-full place-items-center p-8">
        <Orb size={16} label={`Loading ${path}…`} />
      </div>
    );
  }
  if (bytes.error || bytes.data === undefined) {
    return (
      <OpenFailed
        path={path}
        error={bytes.error}
        onRetry={() => void bytes.refetch()}
        retrying={bytes.isFetching}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
        // A checkerboard behind the image, so transparency reads as transparency.
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
        }}
      >
        <img
          src={`data:${bytes.data.mediaType};base64,${bytes.data.base64}`}
          alt={bytes.data.name}
          className="max-h-full max-w-full object-contain"
          onLoad={(e) =>
            setNatural(
              `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`
            )
          }
          // A listed extension the browser still can't decode (a corrupt file,
          // an exotic TIFF-flavoured .ico) reads as an unopenable file, not as
          // a broken image icon.
          onError={() => setUndecodable(true)}
        />
      </div>
      <div className="flex h-8 shrink-0 items-center gap-3 border-t px-3 text-xs text-muted-foreground">
        <span>{bytes.data.mediaType}</span>
        {natural !== null && <span>{natural}</span>}
      </div>
    </div>
  );
}

export function ImageView({ path, theme }: { path: string; theme: Theme }) {
  const prefs = useUiPrefs();
  // Not React state — see `usePanelSize`.
  const source = usePanelSize("svg-source-w", prefs.svgSourceWidth, "width");

  if (!isSvgPath(path)) return <Preview path={path} />;

  return (
    <div className="flex h-full min-h-0">
      <div
        className="flex min-h-0 shrink-0 flex-col overflow-hidden"
        // Capped as a share of the pane so the preview keeps its side in a
        // narrow window, where the stored pixel width would push it off-screen.
        style={{ ...source.style, maxWidth: "60%" }}
      >
        <CodeView path={path} theme={theme} />
      </div>
      <ResizeHandle
        orientation="col"
        value={source.current}
        min={240}
        max={() => Math.max(320, window.innerWidth - 360)}
        onResize={source.onResize}
        onResizeEnd={(w) => setUiPrefs({ svgSourceWidth: w })}
        label="Resize source pane"
      />
      <div className="min-h-0 min-w-0 flex-1">
        <Preview path={path} />
      </div>
    </div>
  );
}
