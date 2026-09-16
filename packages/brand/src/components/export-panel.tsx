import { useState } from "react";
import type { Brand } from "@/lib/use-brand";
import { formatSvg } from "@/brand/svg";
import { ICO_SIZES, download, encodeIco, rasterize } from "@/brand/raster";
import {
  MARK_PNG_SIZES,
  buildAssetPack,
  type PackProgress,
} from "@/brand/pack";
import {
  Button,
  Field,
  Section,
  Segmented,
  Slider,
} from "./controls/primitives";
import { cn } from "@/lib/cn";

type Format = "svg" | "png" | "ico";

const FORMATS = [
  { value: "svg" as const, label: "SVG", title: "Vector, wordmark outlined" },
  { value: "png" as const, label: "PNG", title: "Raster at an exact size" },
  { value: "ico" as const, label: "ICO", title: "Multi-resolution favicon" },
];

export function ExportPanel({ brand }: { brand: Brand }) {
  const { config, scene, svg } = brand;
  const [format, setFormat] = useState<Format>("svg");
  const [width, setWidth] = useState(512);
  const [status, setStatus] = useState<string | null>(null);
  const [pack, setPack] = useState<PackProgress | null>(null);

  const ratio = scene.height / scene.width;
  const height = Math.max(1, Math.round(width * ratio));
  const basename = `reviewer-${config.layout}`;

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2000);
  };

  const handleDownload = async () => {
    if (format === "svg") {
      download(
        new Blob([formatSvg(svg)], { type: "image/svg+xml" }),
        `${basename}.svg`
      );
      return flash("Saved SVG");
    }
    if (format === "png") {
      download(await rasterize(svg, width, height), `${basename}-${width}.png`);
      return flash(`Saved ${width}px PNG`);
    }
    const pngs = await Promise.all(
      ICO_SIZES.map(async (size) => ({
        size,
        bytes: await (await rasterize(svg, size, size)).arrayBuffer(),
      }))
    );
    download(await encodeIco(pngs), "favicon.ico");
    flash("Saved favicon.ico");
  };

  const handleCopy = async () => {
    if (format === "png") {
      const blob = await rasterize(svg, width, height);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return flash("PNG copied");
    }
    await navigator.clipboard.writeText(formatSvg(svg));
    flash("SVG copied");
  };

  const handlePack = async () => {
    setPack({ done: 0, total: 1, label: "Starting…" });
    try {
      const blob = await buildAssetPack(config, brand.text, setPack);
      download(blob, "reviewer-brand-assets.zip");
      flash("Saved asset pack");
    } finally {
      setPack(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
          Export
        </span>
        {status ? (
          <span className="text-[11px] text-emerald-400">{status}</span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Format">
          <Segmented options={FORMATS} value={format} onChange={setFormat} />
          {format === "png" ? (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {MARK_PNG_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setWidth(size)}
                    className={cn(
                      "cursor-pointer rounded-md border border-line py-1.5 font-mono text-[11px] transition-colors",
                      size === width
                        ? "border-white/40 bg-white/10 text-white"
                        : "bg-raised text-muted hover:text-white"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <Slider
                label="Width"
                value={width}
                min={16}
                max={2048}
                step={2}
                format={(value) => `${value}px`}
                onChange={setWidth}
              />
              <p className="font-mono text-[11px] text-muted tabular-nums">
                {width} × {height} px
              </p>
            </>
          ) : null}
          {format === "ico" ? (
            <p className="text-[11px] leading-relaxed text-muted">
              Packs the square mark at {ICO_SIZES.join(", ")}px into one{" "}
              <code className="text-white/70">favicon.ico</code>. Uses the icon
              layout whatever the canvas is showing.
            </p>
          ) : null}
          {format === "svg" ? (
            <p className="text-[11px] leading-relaxed text-muted">
              The wordmark is converted to outlines, so the file renders
              identically without Space Grotesk installed.
            </p>
          ) : null}
        </Section>

        <Section title="Save">
          <Field label="Filename">
            <code className="block truncate rounded-lg border border-line bg-raised px-2.5 py-1.5 font-mono text-[11px] text-white/70">
              {format === "ico"
                ? "favicon.ico"
                : `${basename}${format === "png" ? `-${width}` : ""}.${format}`}
            </code>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => void handleDownload()}>
              Download
            </Button>
            <Button
              onClick={() => void handleCopy()}
              disabled={format === "ico"}
            >
              {format === "png" ? "Copy image" : "Copy SVG"}
            </Button>
          </div>
        </Section>

        <Section title="Asset pack">
          <p className="text-[11px] leading-relaxed text-muted">
            Every layout in every colour variant — SVGs, PNGs at each icon size,
            a favicon and an apple-touch-icon — zipped, using the shape settings
            on the left.
          </p>
          <Button
            onClick={() => void handlePack()}
            disabled={pack !== null}
            className="w-full"
          >
            {pack ? `Building ${pack.done}/${pack.total}…` : "Download .zip"}
          </Button>
          {pack ? (
            <div className="space-y-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${(pack.done / pack.total) * 100}%` }}
                />
              </div>
              <p className="truncate font-mono text-[10px] text-muted">
                {pack.label}
              </p>
            </div>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
