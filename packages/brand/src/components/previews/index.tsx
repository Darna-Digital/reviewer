import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Brand } from "@/lib/use-brand";
import { variantUrl } from "@/lib/variant";

function Frame({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-panel">
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <span className="text-xs font-medium">{title}</span>
        <span className="text-[10px] text-muted">{hint}</span>
      </figcaption>
      <div className={className}>{children}</div>
    </figure>
  );
}

export function Previews({ brand }: { brand: Brand }) {
  const { config, text } = brand;

  const icon = useMemo(
    () => variantUrl(config, text, { layout: "mark", canvasPadding: 0 }),
    [config, text]
  );
  const lockup = useMemo(
    () => variantUrl(config, text, { layout: "horizontal" }),
    [config, text]
  );
  const stacked = useMemo(
    () => variantUrl(config, text, { layout: "stacked" }),
    [config, text]
  );

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      <Frame
        title="Browser tab"
        hint="favicon at 16px"
        className="bg-[#1c1c1f] p-4"
      >
        <div className="rounded-lg bg-[#28282c] pt-2">
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-end gap-1 px-2">
            <div className="flex min-w-0 items-center gap-2 rounded-t-lg bg-[#3a3a40] px-3 py-2">
              <img src={icon} alt="" className="size-4 shrink-0" />
              <span className="truncate text-[11px] text-white/85">
                Reviewer — local git review
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 px-3 py-2 opacity-50">
              <span className="size-4 shrink-0 rounded-sm bg-white/20" />
              <span className="truncate text-[11px] text-white/70">
                Pull requests
              </span>
            </div>
          </div>
          <div className="h-8 rounded-b-lg bg-[#3a3a40]" />
        </div>
      </Frame>

      <Frame
        title="macOS Dock"
        hint="icon at 64px, unmasked"
        className="bg-gradient-to-b from-[#3d5a80] to-[#1d3557] p-6"
      >
        <div className="mx-auto flex w-fit items-end gap-3 rounded-2xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-xl">
          {["#ef4444", "#f59e0b", "#10b981"].map((color) => (
            <span
              key={color}
              className="size-14 rounded-[22.37%]"
              style={{ background: color }}
            />
          ))}
          <div className="flex flex-col items-center gap-1">
            <img src={icon} alt="" className="size-16 drop-shadow-lg" />
            <span className="size-1 rounded-full bg-white/80" />
          </div>
          {["#6366f1", "#ec4899"].map((color) => (
            <span
              key={color}
              className="size-14 rounded-[22.37%]"
              style={{ background: color }}
            />
          ))}
        </div>
      </Frame>

      <Frame
        title="iOS home screen"
        hint="masked to the system squircle"
        className="bg-gradient-to-br from-[#312e81] via-[#6d28d9] to-[#db2777] p-6"
      >
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <img
              src={icon}
              alt=""
              className="size-14 rounded-[22.37%] shadow-lg"
            />
            <span className="text-[10px] text-white drop-shadow">Reviewer</span>
          </div>
          {["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#14b8a6"].map(
            (color) => (
              <div key={color} className="flex flex-col items-center gap-1.5">
                <span
                  className="size-14 rounded-[22.37%] opacity-70 shadow-lg"
                  style={{ background: color }}
                />
                <span className="text-[10px] text-white/60">App</span>
              </div>
            )
          )}
        </div>
      </Frame>

      <Frame
        title="Small sizes"
        hint="16 · 20 · 24 · 32 · 48 · 64px"
        className="divide-y divide-line"
      >
        {[
          { id: "light", background: "#f4f4f5" },
          { id: "dark", background: "#09090b" },
        ].map((row) => (
          <div
            key={row.id}
            className="flex items-end gap-5 px-5 py-6"
            style={{ background: row.background }}
          >
            {[16, 20, 24, 32, 48, 64].map((size) => (
              <img
                key={size}
                src={icon}
                alt=""
                style={{ width: size, height: size }}
              />
            ))}
          </div>
        ))}
      </Frame>

      <Frame
        title="README header"
        hint="horizontal lockup on GitHub"
        className="bg-white p-6"
      >
        <img src={lockup} alt="" className="h-9" />
        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-[#59636e]">
          Review your local git history the way you review a pull request —
          diffs, inline comments and threads, without leaving your machine.
        </p>
        <div className="mt-4 flex gap-2">
          {["MIT", "v0.2.6", "macOS"].map((badge) => (
            <span
              key={badge}
              className="rounded-md bg-[#eaeef2] px-2 py-0.5 text-[10px] text-[#59636e]"
            >
              {badge}
            </span>
          ))}
        </div>
      </Frame>

      <Frame title="Social card" hint="1200 × 630 open graph" className="p-4">
        <div className="flex aspect-[1200/630] items-center justify-center rounded-lg bg-[#09090b] ring-1 ring-line">
          <img src={stacked} alt="" className="max-h-[55%] max-w-[60%]" />
        </div>
      </Frame>

      <Frame title="macOS menu bar" hint="18px status item" className="p-4">
        <div className="flex h-7 items-center justify-end gap-4 rounded-md bg-[#2c2c30] px-3">
          <img src={icon} alt="" className="size-[18px]" />
          <span className="text-[11px] text-white/70">100%</span>
          <span className="text-[11px] text-white/70">Wed 16 Sep</span>
        </div>
      </Frame>

      <Frame
        title="Sidebar and lists"
        hint="24px next to a label"
        className="bg-[#0f0f12] p-4"
      >
        <div className="space-y-1">
          {["Reviewer", "Changes", "Threads"].map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
              style={{
                background: index === 0 ? "rgba(255,255,255,0.07)" : undefined,
              }}
            >
              {index === 0 ? (
                <img src={icon} alt="" className="size-6 rounded" />
              ) : (
                <span className="size-6 rounded bg-white/10" />
              )}
              <span className="text-xs text-white/80">{label}</span>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}
