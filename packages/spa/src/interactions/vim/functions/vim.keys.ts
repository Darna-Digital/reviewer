/**
 * The Vim key grammar, as a parser over the keys typed so far.
 *
 * Normal mode reads `[count] ( operator [count] motion | operator operator |
 * action )`, and the only way to know whether `2d` is a command is to know that
 * it is not one *yet*. So the keys accumulate in `VimState.pending` and the
 * whole run is re-parsed on every keystroke: "pending" keeps them, "command"
 * spends them, "none" throws them away — which is what makes a mistyped chord
 * cost one keystroke rather than leaving the editor in a state nobody asked for.
 *
 * Visual mode has its own, smaller grammar: motions extend the selection and an
 * operator acts on it rather than taking a motion of its own.
 */
import type {
  VimMotion,
  VimOperator,
  VimParse,
} from "../interfaces/vim.interfaces";

const OPERATORS: Readonly<Record<string, VimOperator>> = {
  d: "delete",
  c: "change",
  y: "yank",
};

/** Motions spelled with a single key. */
const SIMPLE_MOTIONS: Readonly<Record<string, VimMotion>> = {
  h: { kind: "left" },
  l: { kind: "right" },
  " ": { kind: "right" },
  k: { kind: "up" },
  j: { kind: "down" },
  w: { kind: "wordForward", big: false },
  W: { kind: "wordForward", big: true },
  b: { kind: "wordBack", big: false },
  B: { kind: "wordBack", big: true },
  e: { kind: "wordEnd", big: false },
  E: { kind: "wordEnd", big: true },
  "0": { kind: "lineStart" },
  "^": { kind: "firstNonBlank" },
  $: { kind: "lineEnd" },
  G: { kind: "fileEnd" },
};

/** Keys that take the next keystroke as an argument rather than a command. */
const AWAITS_ARGUMENT = new Set(["f", "F", "t", "T", "r"]);

interface Counted {
  /** The count typed, or null when none was — `0` is a motion, not a count. */
  readonly count: number | null;
  /** What is left after the digits. */
  readonly rest: string;
}

const takeCount = (input: string): Counted => {
  // A leading `0` is the start-of-line motion; a `0` after other digits is part
  // of the count.
  const match = /^[1-9][0-9]*/.exec(input);
  if (match === null) return { count: null, rest: input };
  return { count: Number(match[0]), rest: input.slice(match[0].length) };
};

type MotionParse =
  | { readonly kind: "pending" }
  | { readonly kind: "none" }
  | { readonly kind: "motion"; readonly motion: VimMotion };

/** The motion `input` spells, or how far off it is from spelling one. */
function parseMotion(input: string): MotionParse {
  const key = input[0];
  if (key === undefined) return { kind: "pending" };

  if (key === "g") {
    const second = input[1];
    if (second === undefined) return { kind: "pending" };
    return second === "g"
      ? { kind: "motion", motion: { kind: "fileStart" } }
      : { kind: "none" };
  }

  if (key === "f" || key === "F" || key === "t" || key === "T") {
    const char = input[1];
    if (char === undefined) return { kind: "pending" };
    if (input.length > 2) return { kind: "none" };
    return {
      kind: "motion",
      motion: {
        kind: "findChar",
        char,
        forward: key === "f" || key === "t",
        till: key === "t" || key === "T",
      },
    };
  }

  const simple = SIMPLE_MOTIONS[key];
  if (simple !== undefined && input.length === 1) {
    return { kind: "motion", motion: simple };
  }
  return { kind: "none" };
}

/** Motions that read a count as "go to line N" rather than "do it N times". */
const asLineTarget = (motion: VimMotion, count: number | null): VimMotion =>
  count !== null && (motion.kind === "fileEnd" || motion.kind === "fileStart")
    ? { kind: "goToLine", line: count - 1 }
    : motion;

const move = (motion: VimMotion, count: number | null): VimParse => ({
  kind: "command",
  command: {
    kind: "move",
    motion: asLineTarget(motion, count),
    count:
      motion.kind === "fileEnd" || motion.kind === "fileStart"
        ? 1
        : (count ?? 1),
  },
});

/** What `input` spells in normal mode. */
export function parseNormal(input: string): VimParse {
  if (input.length === 0) return { kind: "pending" };
  const { count, rest } = takeCount(input);
  if (rest.length === 0) return { kind: "pending" };
  const key = rest[0];
  const times = count ?? 1;

  const operator = OPERATORS[key];
  if (operator !== undefined) {
    const after = rest.slice(1);
    if (after.length === 0) return { kind: "pending" };
    // `dd`, `cc`, `yy` — the operator doubled takes whole lines.
    if (after[0] === key) {
      return after.length === 1
        ? {
            kind: "command",
            command: { kind: "operateLines", operator, count: times },
          }
        : { kind: "none" };
    }
    const inner = takeCount(after);
    if (inner.rest.length === 0) return { kind: "pending" };
    const parsed = parseMotion(inner.rest);
    if (parsed.kind !== "motion") return parsed;
    const { motion } = parsed;
    const scale = times * (inner.count ?? 1);
    if (motion.kind === "fileEnd" && inner.count !== null) {
      return {
        kind: "command",
        command: {
          kind: "operate",
          operator,
          motion: { kind: "goToLine", line: inner.count - 1 },
          count: 1,
        },
      };
    }
    return {
      kind: "command",
      command: { kind: "operate", operator, motion, count: scale },
    };
  }

  // `>>` / `<<` — indent the lines the count covers.
  if (key === ">" || key === "<") {
    const after = rest.slice(1);
    if (after.length === 0) return { kind: "pending" };
    return after[0] === key
      ? {
          kind: "command",
          command: {
            kind: "operateLines",
            operator: key === ">" ? "indent" : "outdent",
            count: times,
          },
        }
      : { kind: "none" };
  }

  if (key === "g") {
    const after = rest.slice(1);
    if (after.length === 0) return { kind: "pending" };
    if (after[0] !== "g") return { kind: "none" };
    return count === null
      ? {
          kind: "command",
          command: { kind: "move", motion: { kind: "fileStart" }, count: 1 },
        }
      : {
          kind: "command",
          command: {
            kind: "move",
            motion: { kind: "goToLine", line: count - 1 },
            count: 1,
          },
        };
  }

  if (key === "r") {
    const after = rest.slice(1);
    return after.length === 0
      ? { kind: "pending" }
      : { kind: "command", command: { kind: "replaceChar", char: after[0] } };
  }

  if (AWAITS_ARGUMENT.has(key)) {
    const parsed = parseMotion(rest);
    return parsed.kind === "motion" ? move(parsed.motion, count) : parsed;
  }

  const simple = SIMPLE_MOTIONS[key];
  if (simple !== undefined && rest.length === 1) return move(simple, count);
  if (rest.length > 1) return { kind: "none" };

  switch (key) {
    case "i":
      return { kind: "command", command: { kind: "insert", at: "before" } };
    case "a":
      return { kind: "command", command: { kind: "insert", at: "after" } };
    case "I":
      return { kind: "command", command: { kind: "insert", at: "lineStart" } };
    case "A":
      return { kind: "command", command: { kind: "insert", at: "lineEnd" } };
    case "o":
      return { kind: "command", command: { kind: "insert", at: "openBelow" } };
    case "O":
      return { kind: "command", command: { kind: "insert", at: "openAbove" } };
    case "x":
      return {
        kind: "command",
        command: { kind: "deleteChar", before: false, count: times },
      };
    case "X":
      return {
        kind: "command",
        command: { kind: "deleteChar", before: true, count: times },
      };
    case "D":
      return {
        kind: "command",
        command: {
          kind: "operate",
          operator: "delete",
          motion: { kind: "lineEnd" },
          count: 1,
        },
      };
    case "C":
      return {
        kind: "command",
        command: {
          kind: "operate",
          operator: "change",
          motion: { kind: "lineEnd" },
          count: 1,
        },
      };
    case "Y":
      return {
        kind: "command",
        command: { kind: "operateLines", operator: "yank", count: times },
      };
    case "S":
      return {
        kind: "command",
        command: { kind: "operateLines", operator: "change", count: times },
      };
    case "s":
      return {
        kind: "command",
        command: {
          kind: "operate",
          operator: "change",
          motion: { kind: "right" },
          count: times,
        },
      };
    case "p":
      return {
        kind: "command",
        command: { kind: "put", after: true, count: times },
      };
    case "P":
      return {
        kind: "command",
        command: { kind: "put", after: false, count: times },
      };
    case "J":
      return { kind: "command", command: { kind: "join", count: times } };
    case "u":
      return { kind: "command", command: { kind: "undo" } };
    case "v":
      return {
        kind: "command",
        command: { kind: "enterVisual", line: false },
      };
    case "V":
      return { kind: "command", command: { kind: "enterVisual", line: true } };
    default:
      return { kind: "none" };
  }
}

/** What `input` spells in visual or visual-line mode. */
export function parseVisual(input: string): VimParse {
  if (input.length === 0) return { kind: "pending" };
  const { count, rest } = takeCount(input);
  if (rest.length === 0) return { kind: "pending" };
  const key = rest[0];

  switch (key) {
    case "d":
    case "x":
      return {
        kind: "command",
        command: { kind: "operateSelection", operator: "delete" },
      };
    case "c":
    case "s":
      return {
        kind: "command",
        command: { kind: "operateSelection", operator: "change" },
      };
    case "y":
      return {
        kind: "command",
        command: { kind: "operateSelection", operator: "yank" },
      };
    case ">":
      return {
        kind: "command",
        command: { kind: "operateSelection", operator: "indent" },
      };
    case "<":
      return {
        kind: "command",
        command: { kind: "operateSelection", operator: "outdent" },
      };
    case "v":
      return { kind: "command", command: { kind: "enterVisual", line: false } };
    case "V":
      return { kind: "command", command: { kind: "enterVisual", line: true } };
    default:
      break;
  }

  if (key === "g") {
    const after = rest.slice(1);
    if (after.length === 0) return { kind: "pending" };
    if (after[0] !== "g") return { kind: "none" };
    return {
      kind: "command",
      command: {
        kind: "move",
        motion:
          count === null
            ? { kind: "fileStart" }
            : { kind: "goToLine", line: count - 1 },
        count: 1,
      },
    };
  }

  if (AWAITS_ARGUMENT.has(key) && key !== "r") {
    const parsed = parseMotion(rest);
    return parsed.kind === "motion" ? move(parsed.motion, count) : parsed;
  }

  const simple = SIMPLE_MOTIONS[key];
  if (simple !== undefined && rest.length === 1) return move(simple, count);
  return { kind: "none" };
}
