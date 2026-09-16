import { useState } from "react";
import { ControlPanel } from "./components/controls/panel";
import { ExportPanel } from "./components/export-panel";
import { CodeView } from "./components/code-view";
import { Previews } from "./components/previews";
import { Stage } from "./components/stage";
import { useBrand } from "./lib/use-brand";
import { cn } from "./lib/cn";

const TABS = [
  { id: "canvas", label: "Canvas" },
  { id: "previews", label: "In context" },
  { id: "code", label: "Source" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function App() {
  const brand = useBrand();
  const [tab, setTab] = useState<Tab>("canvas");

  return (
    <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_300px] bg-ink">
      <aside className="min-h-0 border-r border-line bg-panel">
        <ControlPanel brand={brand} />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-sm font-medium">Reviewer brand studio</h1>
            <span className="text-[11px] text-muted">
              {brand.fontReady
                ? "Space Grotesk loaded"
                : "Loading Space Grotesk…"}
            </span>
          </div>
          <div className="flex gap-1 rounded-lg bg-raised p-1">
            {TABS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors",
                  option.id === tab
                    ? "bg-white text-ink"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "canvas" ? <Stage brand={brand} /> : null}
          {tab === "previews" ? (
            <div className="h-full overflow-y-auto">
              <Previews brand={brand} />
            </div>
          ) : null}
          {tab === "code" ? <CodeView brand={brand} /> : null}
        </div>
      </main>

      <aside className="min-h-0 border-l border-line bg-panel">
        <ExportPanel brand={brand} />
      </aside>
    </div>
  );
}
