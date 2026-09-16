import { useState } from "react";
import type { Brand } from "@/lib/use-brand";
import { cn } from "@/lib/cn";

const BACKDROPS = [
  { id: "checker", label: "Transparent", className: "checkerboard" },
  { id: "dark", label: "Dark", className: "bg-[#0b0b0d]" },
  { id: "light", label: "Light", className: "bg-[#f4f4f5]" },
  { id: "mid", label: "Mid", className: "bg-[#7c7c85]" },
  { id: "brand", label: "Colour", className: "bg-[#1565c0]" },
];

export function Stage({ brand }: { brand: Brand }) {
  const [backdrop, setBackdrop] = useState(BACKDROPS[0]);
  const { scene, svg } = brand;
  const ratio = scene.width / scene.height;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-10",
          backdrop.className
        )}
      >
        <div
          className="max-h-full max-w-full [&>svg]:block [&>svg]:size-full"
          style={{
            aspectRatio: ratio,
            width: ratio >= 1 ? "100%" : "auto",
            height: ratio >= 1 ? "auto" : "100%",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-2.5">
        <div className="flex gap-1">
          {BACKDROPS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBackdrop(option)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 text-[11px] transition-colors",
                option.id === backdrop.id
                  ? "bg-white/10 text-white"
                  : "text-muted hover:text-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {Math.round(scene.width)} × {Math.round(scene.height)} · ratio{" "}
          {ratio.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
