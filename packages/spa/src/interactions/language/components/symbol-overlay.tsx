/**
 * What a token's floating card actually shows: hover documentation while the
 * pointer rests on a symbol, and after a click either its usages or a choice of
 * declarations.
 *
 * All three open the same way and answer the same gesture, so all three open
 * with the same heading: the symbol set in the code font, and a chip for what
 * it is. What follows differs by how much there is of it. A hover is four lines
 * about one symbol and runs flush from the heading on one steady gap; a list
 * can be forty rows and scrolls under a heading that stays put, which needs a
 * rule to sit against. The shared pieces live in `card-chrome`.
 *
 * The cards own their padding rather than taking it from the card shell,
 * because a list wants its rows to reach the edges (a row is a target, and a
 * target with a gutter around it reads as a gap between rows) while prose wants
 * a margin.
 */
import {
  IconArrowRight,
  IconLink,
  IconLoader2,
  IconSearch,
} from "@tabler/icons-react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type {
  Location,
  SymbolReference,
  SymbolTarget,
} from "@byconvo/core/language";
import { cn } from "@/lib/utils";
import { splitHover } from "../functions/hover-parts";
import { CardChip, CardHeading, CardLink, CardRule } from "./card-chrome";

/**
 * `src/a/b.ts` -> `src/a`, so the name can be kept while the path clips. The
 * separator is deliberately left off: the directory is laid out right-to-left
 * so that it clips at its start, and a trailing slash is a neutral character —
 * the browser resolves it against that direction and prints it at the *front*
 * of the run, which is how `src/a/b.ts` used to render as `/srca` + `b.ts`.
 */
const directoryOf = (path: string) => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
};
const basenameOf = (path: string) => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? path : path.slice(cut + 1);
};

/**
 * A declaration is where the symbol comes from and a write is where it changes:
 * both are worth spotting in a long list, and a read — the common case — is
 * not, so it stays as quiet as the count above it.
 */
const REFERENCE_KIND = {
  definition: { label: "declaration", tone: "accent" },
  write: { label: "write", tone: "attention" },
  read: { label: "read", tone: "neutral" },
} as const;

/** Every list on a card is the same list, so the rows are laid out once. */
function LocationRow({
  location,
  preview,
  detail,
  onOpen,
}: {
  location: Location;
  preview: string;
  detail?: React.ReactNode;
  onOpen: (location: Location) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-baseline gap-2.5 rounded-sm px-2 py-1 text-left text-[13px] outline-hidden hover:bg-elevate focus-visible:bg-elevate"
        onClick={() => onOpen(location)}
      >
        {/* The file name carries the information, so the directory is what
            gets clipped — truncating from the right would hide the name. */}
        <span className="flex max-w-[16rem] min-w-0 shrink-0 items-baseline text-muted-foreground">
          <span className="min-w-0 truncate text-right" dir="rtl">
            {directoryOf(location.path)}
          </span>
          <span className="shrink-0 font-medium text-foreground">
            {directoryOf(location.path).length > 0 && (
              <span className="font-normal text-muted-foreground">/</span>
            )}
            {basenameOf(location.path)}
          </span>
          <span className="shrink-0">:{location.range.start.line + 1}</span>
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
          {preview}
        </span>
        {detail}
      </button>
    </li>
  );
}

/** The frame every card body sits in: heading, rule, answer. */
function CardShell({
  heading,
  children,
  className,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // `bg-inherit` twice over: the card shell is the scroll container, so the
    // heading is stuck to its top, and a sticky element needs a background of
    // its own or the rows would scroll through it. Inheriting picks up whatever
    // surface the popup landed on rather than guessing at a colour.
    <div className={cn("flex min-w-0 flex-col bg-inherit", className)}>
      <div className="sticky top-0 z-10 bg-inherit">
        <div className="px-3 py-2.5">{heading}</div>
        <CardRule />
      </div>
      {children}
    </div>
  );
}

/**
 * Hover documentation, taken apart so it reads as a description of a symbol
 * rather than as a page of markdown: the signature in its own panel, the doc
 * comment underneath it, and whatever the server linked to in a footer.
 */
export function HoverDocumentation({
  symbol,
  contents,
}: {
  /** The token the pointer is on — the heading, and the only name we are sure of. */
  symbol: string;
  contents: string;
}) {
  const { kind, signature, body, links } = splitHover(contents);

  if (signature.length === 0 && body.length === 0 && links.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No information</p>;
  }

  return (
    // No rule and no sections: a hover is one short description of one symbol,
    // and dividing four lines of it into compartments makes it look like more
    // than it is. The rhythm is the whole layout — one gap, held everywhere.
    //
    // `max-w`: prose needs a measure. Left to itself the card is as wide as the
    // longest signature, which for a generic type is most of the screen.
    <div className="flex max-w-[25rem] min-w-0 flex-col gap-1.5 p-3 text-sm">
      <CardHeading name={symbol} kind={kind} />
      {signature.length > 0 && (
        // One ink rather than the full syntax palette. A signature is read as a
        // whole — colouring it token by token turns four words into confetti,
        // and the code it was pulled out of is already highlighted behind the
        // card. The panel's job is to say "this is the declaration".
        <code
          data-slot="card-signature"
          className="block rounded bg-elevate-strong px-2 py-1 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-emerald-700 dark:text-emerald-300"
        >
          {signature}
        </code>
      )}
      {body.length > 0 && (
        <div className="markdown markdown-hover min-w-0 text-foreground/85">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {body}
          </Markdown>
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {links.map((link) => (
            <CardLink key={link.href} href={link.href} icon={IconLink}>
              {link.label}
            </CardLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function UsagesList({
  symbol,
  references,
  onOpen,
}: {
  symbol: string;
  references: ReadonlyArray<SymbolReference>;
  onOpen: (location: Location) => void;
}) {
  return (
    <CardShell
      className="min-w-[22rem]"
      heading={
        <CardHeading
          icon={IconSearch}
          name={symbol}
          meta={`${references.length} usage${references.length === 1 ? "" : "s"}`}
        />
      }
    >
      <ul className="p-1.5">
        {references.map((reference) => {
          const { label, tone } = REFERENCE_KIND[reference.kind];
          return (
            <LocationRow
              key={`${reference.location.path}:${reference.location.range.start.line}:${reference.location.range.start.character}`}
              location={reference.location}
              preview={reference.preview}
              detail={<CardChip tone={tone}>{label}</CardChip>}
              onOpen={onOpen}
            />
          );
        })}
      </ul>
    </CardShell>
  );
}

export function TargetChoice({
  targets,
  onOpen,
}: {
  targets: ReadonlyArray<SymbolTarget>;
  onOpen: (location: Location) => void;
}) {
  // Every target is a declaration of the same symbol, so any of them names it.
  const symbol = targets[0]?.name ?? "";
  return (
    <CardShell
      className="min-w-[22rem]"
      heading={
        <CardHeading
          icon={IconArrowRight}
          name={symbol}
          meta={`${targets.length} declaration${targets.length === 1 ? "" : "s"}`}
        />
      }
    >
      <ul className="p-1.5">
        {targets.map((target) => (
          <LocationRow
            key={`${target.location.path}:${target.location.range.start.line}:${target.location.range.start.character}`}
            location={target.location}
            preview={target.preview}
            detail={
              target.kind === "" ? undefined : (
                <CardChip>{target.kind}</CardChip>
              )
            }
            onOpen={onOpen}
          />
        ))}
      </ul>
    </CardShell>
  );
}

export function CardSpinner({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
      <IconLoader2 className="size-3.5 animate-spin" />
      {label}
    </p>
  );
}
