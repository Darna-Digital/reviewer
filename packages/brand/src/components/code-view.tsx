import { useState } from "react";
import { formatSvg } from "@/brand/svg";
import type { Brand } from "@/lib/use-brand";
import { Button } from "./controls/primitives";

export function CodeView({ brand }: { brand: Brand }) {
  const [copied, setCopied] = useState(false);
  const source = formatSvg(brand.svg);

  const copy = async () => {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted">
          {new Blob([source]).size} bytes
        </span>
        <Button onClick={() => void copy()}>
          {copied ? "Copied" : "Copy source"}
        </Button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-white/75">
        {source}
      </pre>
    </div>
  );
}
