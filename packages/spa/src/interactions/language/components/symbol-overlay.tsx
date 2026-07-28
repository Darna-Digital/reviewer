/**
 * What a token's floating card actually shows: hover documentation while the
 * pointer rests on a symbol, and after a click either its usages or a choice of
 * declarations.
 */
import { IconArrowRight, IconLoader2 } from "@tabler/icons-react"
import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import type {
  Location,
  SymbolReference,
  SymbolTarget,
} from "@byconvo/core/language"
import { cn } from "@/lib/utils"

const REFERENCE_KIND_LABEL = {
  definition: "declaration",
  write: "write",
  read: "read",
} as const

/** One row in a usage or declaration list. */
function LocationRow({
  location,
  preview,
  detail,
  onOpen,
}: {
  location: Location
  preview: string
  detail?: string
  onOpen: (location: Location) => void
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
        onClick={() => onOpen(location)}
      >
        {/* Paths are repository-relative already, so they read as written. */}
        <span className="max-w-[14rem] shrink-0 truncate text-muted-foreground">
          {location.path}:{location.range.start.line + 1}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">
          {preview}
        </span>
        {detail !== undefined && (
          <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
            {detail}
          </span>
        )}
      </button>
    </li>
  )
}

export function HoverDocumentation({ contents }: { contents: string }) {
  if (contents.trim().length === 0) {
    return <p className="px-1 text-xs text-muted-foreground">No information</p>
  }
  return (
    <div className="markdown min-w-0 text-xs [&_pre]:my-1 [&_pre]:text-xs">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {contents}
      </Markdown>
    </div>
  )
}

export function UsagesList({
  symbol,
  references,
  onOpen,
}: {
  symbol: string
  references: ReadonlyArray<SymbolReference>
  onOpen: (location: Location) => void
}) {
  return (
    <div className="min-w-[20rem]">
      <p className="px-2 pb-1 text-xs text-muted-foreground">
        {references.length} usage{references.length === 1 ? "" : "s"} of{" "}
        <span className="font-mono text-foreground">{symbol}</span>
      </p>
      <ul>
        {references.map((reference) => (
          <LocationRow
            key={`${reference.location.path}:${reference.location.range.start.line}:${reference.location.range.start.character}`}
            location={reference.location}
            preview={reference.preview}
            detail={REFERENCE_KIND_LABEL[reference.kind]}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  )
}

export function TargetChoice({
  targets,
  onOpen,
}: {
  targets: ReadonlyArray<SymbolTarget>
  onOpen: (location: Location) => void
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
  )
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
  )
}
