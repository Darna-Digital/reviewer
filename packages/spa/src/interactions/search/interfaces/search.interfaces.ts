/**
 * `search` feature — one dialog, a handful of lists, three ways in: ⌘K for the
 * commands it opens on, a double-tap of Shift to go straight to files, and ⌘⇧F
 * to go straight to a content grep. Every list past the commands is also a plain
 * entry in the command list, so the keyboard shortcuts are accelerators for
 * something you can always find by reading.
 *
 * The searches themselves are one call each, but the rules around them (what is
 * too short to search for, how matches group under their file, which slice of a
 * line the pattern actually hit, how a query scores against a path) are pure and
 * live behind injected side effects so the dialog stays declarative.
 */
import type {
  BranchInfo,
  ContentMatch,
  RemoteBranchInfo,
} from "@reviewer/core/repo";

export type { BranchInfo, ContentMatch, RemoteBranchInfo };

/** Which of the dialog's lists is on screen. */
export type SearchMode = "commands" | "files" | "text" | "git" | "branches";

/** One step of the dialog's breadcrumb trail. */
export interface Crumb {
  readonly mode: SearchMode;
  readonly label: string;
}

/**
 * A list the dialog can walk into, and the list it walks back to. One table of
 * these is what gives every mode its breadcrumb trail, its row in the list above
 * it, and where Backspace on an empty query goes.
 */
export interface Submenu {
  readonly mode: Exclude<SearchMode, "commands">;
  readonly parent: SearchMode;
  /** How the row that opens it reads, e.g. "Go to File…". */
  readonly label: string;
  readonly group: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly keywords: string;
  /** Right-aligned shortcut on the row that opens it. */
  readonly hint?: string;
}

/** An app action offered by the command list. Built by the shell that has
 * navigation, git and preferences in scope, so the dialog stays presentational. */
export interface Command {
  readonly id: string;
  readonly label: string;
  /** Heading the command is grouped under (e.g. "Navigation", "Git"). */
  readonly group: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  /** Extra search terms not shown in the label (e.g. "dark light system"). */
  readonly keywords?: string;
  /** Right-aligned hint — a current value or shortcut. */
  readonly hint?: string;
  /** The list the command lives in; the root command list when omitted. */
  readonly submenu?: SearchMode;
  readonly run: () => void;
}

/** A branch the checkout list offers, local and remote flattened into one row. */
export interface BranchChoice {
  /** Full display name, e.g. "task/BMB-207" or "origin/feature". */
  readonly name: string;
  /** The ref to check out — a local name, or a remote's tracking name. */
  readonly ref: string;
  readonly group: "Local" | "Remote";
  readonly isCurrent: boolean;
  /** Right-aligned note — ahead/behind counts, or which remote it came from. */
  readonly hint?: string;
}

/** The match modifiers, mirroring the `git grep` flags behind them. */
export interface GrepOptions {
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
}

/**
 * How wide a search runs: the repository being followed, or every root the open
 * project holds. A multi-root project searches the project — a match in
 * `backend` is as findable as one in `frontend`, and comes back named from the
 * project root (`backend/src/a.ts`) so opening it needs nothing else.
 */
export type SearchScope = "repo" | "project";

export interface GrepResults {
  readonly matches: ReadonlyArray<ContentMatch>;
  /** The server had more matches than the limit allowed through. */
  readonly truncated: boolean;
}

/** One file's matches, in the order git reported them. */
export interface FileMatches {
  readonly path: string;
  readonly matches: ReadonlyArray<ContentMatch>;
}

/** The slice of a match's line the pattern hit, for highlighting. */
export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

export interface SearchDependencies {
  data: {
    /** Below this, a query matches so much that searching is just noise. */
    readonly minQueryLength: number;
  };
  sideEffects: {
    readonly grep: (
      query: string,
      options: GrepOptions,
      scope: SearchScope
    ) => Promise<GrepResults>;
  };
}

export interface SearchFunctions {
  /** Search file contents; too-short queries resolve empty without a request. */
  readonly grep: (
    query: string,
    options: GrepOptions,
    scope: SearchScope
  ) => Promise<GrepResults>;
}

/** Keyboard event fields the shortcut rules read — a plain object in tests. */
export interface KeyChord {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  /** Set while a key is held down and auto-repeating. */
  readonly repeat: boolean;
}

/** When Shift was last tapped on its own, if it still counts towards a pair. */
export interface ShiftTaps {
  readonly lastTapAt: number | null;
}

export interface ShiftTapOutcome {
  readonly taps: ShiftTaps;
  readonly doubleTapped: boolean;
}
