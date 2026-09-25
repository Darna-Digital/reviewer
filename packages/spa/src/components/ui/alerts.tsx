"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogSubject,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeConfirm } from "@/lib/desktop";

/**
 * The app's questions, asked in our own dialog rather than the browser's.
 *
 * `window.confirm` and `window.prompt` are the two places the product used to
 * hand the user off to something that looks nothing like it — a system sheet in
 * the system's own type, with the system's own button order, which in the
 * desktop shell freezes the renderer while it is up. These read the same, and
 * are called the same way: `await confirm({ … })` answers `true` or `false`,
 * `await askForText({ … })` answers the text or `null`, so a call site keeps
 * the shape it already had.
 *
 * Asking is imperative on purpose. Most of these questions are the first line
 * of an async handler — "delete this?", "discard that?" — and threading open
 * state and a pending callback through the component that happens to own the
 * handler is a lot of ceremony for a yes or no. Like `toast`, the ask goes to a
 * store outside React and `<Alerts />`, mounted once at the root, is what
 * draws it.
 */

export interface ConfirmOptions {
  /** The question itself, as a short sentence. */
  readonly title: string;
  /**
   * What the question is about — a path, a branch name — when naming it inside
   * the question would make the question long. It gets its own line below,
   * which is what keeps `title` a short sentence at any width.
   */
  readonly subject?: string;
  /**
   * What is about to happen, and whether it can be taken back. Plain text, so
   * the desktop shell can ask the same question in a native sheet.
   */
  readonly description?: string;
  /** Names the answer that goes ahead. Defaults to "Continue". */
  readonly confirmLabel?: string;
  /** Names the answer that changes nothing. Defaults to "Cancel". */
  readonly cancelLabel?: string;
  /** Paints the confirming button as the destructive one. */
  readonly destructive?: boolean;
}

export interface AskForTextOptions extends Omit<ConfirmOptions, "destructive"> {
  /** Names the field, above it. */
  readonly label?: string;
  readonly placeholder?: string;
  /** What the field holds when it opens; it starts selected. */
  readonly defaultValue?: string;
}

type Ask =
  | {
      readonly kind: "confirm";
      readonly id: number;
      readonly options: ConfirmOptions;
      readonly settle: (answer: boolean) => void;
    }
  | {
      readonly kind: "text";
      readonly id: number;
      readonly options: AskForTextOptions;
      readonly settle: (answer: string | null) => void;
    };

// --- the store -------------------------------------------------------------
// A queue rather than a single slot: asks can stack (a drop that lands on top
// of three existing files asks three times), and each one has a promise
// waiting on it, so none of them may be dropped on the floor.

let queue: ReadonlyArray<Ask> = [];
let nextId = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const peek = (): Ask | null => queue[0] ?? null;
/** Nothing is ever asked while rendering on the server. */
const peekOnServer = (): Ask | null => null;

const enqueue = (ask: Ask) => {
  queue = [...queue, ask];
  emit();
};

const drop = (id: number) => {
  queue = queue.filter((ask) => ask.id !== id);
  emit();
};

/**
 * Ask a yes/no question. Resolves `true` only if it was answered yes. Inside
 * the desktop shell the shell asks it, as a sheet on its window.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (nativeConfirm !== undefined) return nativeConfirm(options);
  return new Promise<boolean>((resolve) => {
    enqueue({ kind: "confirm", id: nextId++, options, settle: resolve });
  });
}

/** Ask for a line of text. Resolves `null` if the question was dismissed. */
export function askForText(options: AskForTextOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    enqueue({ kind: "text", id: nextId++, options, settle: resolve });
  });
}

// --- the host --------------------------------------------------------------

/** Draws whatever has been asked. Mount once, beside `<Toaster />`. */
export function Alerts() {
  const next = useSyncExternalStore(subscribe, peek, peekOnServer);
  // The ask on screen is held here rather than read straight off the queue, so
  // it stays drawn through the closing animation after it has been answered.
  const [showing, setShowing] = useState<Ask | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const field = useRef<HTMLInputElement | null>(null);
  const fieldId = useId();

  useEffect(() => {
    if (showing !== null || next === null) return;
    setShowing(next);
    setText(next.kind === "text" ? (next.options.defaultValue ?? "") : "");
    setOpen(true);
  }, [next, showing]);

  // Answering settles the promise the caller is holding and starts the close;
  // the ask is only forgotten once the animation has run, in `showing`'s reset.
  // `open` is the guard against answering twice: Escape closes the dialog and
  // reports the close, and both arrive here.
  const answer = (accepted: boolean) => {
    if (showing === null || !open) return;
    if (showing.kind === "confirm") showing.settle(accepted);
    else showing.settle(accepted ? text : null);
    drop(showing.id);
    setOpen(false);
  };

  const options = showing?.options;
  return (
    <AlertDialog
      open={open}
      // Escape is the only way out other than the two buttons, and it means no.
      onOpenChange={(isOpen) => {
        if (!isOpen) answer(false);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setShowing(null);
      }}
    >
      {showing !== null && options !== undefined && (
        <AlertDialogContent
          initialFocus={showing.kind === "text" ? field : undefined}
        >
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              answer(true);
            }}
          >
            {/* Question, then the thing it is about, then the consequence —
                the order the eye needs them in to decide. */}
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              {options.subject !== undefined && (
                <AlertDialogSubject className="my-0.5">
                  {options.subject}
                </AlertDialogSubject>
              )}
              {options.description !== undefined && (
                <AlertDialogDescription>
                  {options.description}
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
            {showing.kind === "text" && (
              <div className="flex flex-col gap-1.5">
                {showing.options.label !== undefined && (
                  <label
                    htmlFor={fieldId}
                    className="text-base font-medium sm:text-sm"
                  >
                    {showing.options.label}
                  </label>
                )}
                <Input
                  id={fieldId}
                  ref={field}
                  value={text}
                  placeholder={showing.options.placeholder}
                  onChange={(event) => setText(event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            )}
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => answer(false)}
              >
                {options.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                type="submit"
                variant={
                  showing.kind === "confirm" && showing.options.destructive
                    ? "destructive"
                    : "default"
                }
              >
                {options.confirmLabel ?? "Continue"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
