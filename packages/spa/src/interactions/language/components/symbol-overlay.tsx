/**
 * What a token's floating card actually shows: hover documentation while the
 * pointer rests on a symbol, and after a click a choice of declarations when
 * there is more than one. Usages have their own window — see `find-usages`.
 */
import { IconArrowRight, IconLoader2 } from "@tabler/icons-react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { Location, SymbolTarget } from "@byconvo/core/language";
import { cn } from "@/lib/utils";

/** `src/a/b.ts` -> `src/a/`, so the name can be kept while the path clips. */
const directoryOf = (path: string) => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut + 1);
};
const basenameOf = (path: string) => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? path : path.slice(cut + 1);
};

/** One row in a usage or declaration list. */
function LocationRow({
  location,
  preview,
  detail,
  onOpen,
}: {
  location: Location;
  preview: string;
  detail?: string;
  onOpen: (location: Location) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-elevate"
        onClick={() => onOpen(location)}
      >
        {/* The file name carries the information, so the directory is what
            gets clipped — truncating from the right would hide the name. */}
        <span className="flex max-w-[16rem] min-w-0 shrink-0 items-baseline text-muted-foreground">
          <span className="min-w-0 truncate text-right" dir="rtl">
            {directoryOf(location.path)}
          </span>
          <span className="shrink-0 text-foreground">
            {basenameOf(location.path)}:{location.range.start.line + 1}
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">
          {preview}
        </span>
        {detail !== undefined && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {detail}
          </span>
        )}
      </button>
    </li>
  );
}

export function HoverDocumentation({ contents }: { contents: string }) {
  if (contents.trim().length === 0) {
    return <p className="px-1 text-xs text-muted-foreground">No information</p>;
  }
  return (
    <div className="markdown min-w-0 text-xs [&_pre]:my-1 [&_pre]:text-xs">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {contents}
      </Markdown>
    </div>
  );
}

export function TargetChoice({
  targets,
  onOpen,
}: {
  targets: ReadonlyArray<SymbolTarget>;
  onOpen: (location: Location) => void;
}) {
  return (
    <div className="min-w-[20rem]">
      <p className="flex items-center gap-1 px-2 pb-1 text-xs text-muted-foreground">
        <IconArrowRight className="size-3" />
        {targets.length} declarations
      </p>
      <ul>
        {targets.map((target) => (
          <LocationRow
            key={`${target.location.path}:${target.location.range.start.line}:${target.location.range.start.character}`}
            location={target.location}
            preview={target.preview}
            detail={target.kind === "" ? undefined : target.kind}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
}

export function CardSpinner({ label }: { label: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 px-1 text-xs text-muted-foreground"
      )}
    >
      <IconLoader2 className="size-3.5 animate-spin" />
      {label}
    </p>
  );
}
