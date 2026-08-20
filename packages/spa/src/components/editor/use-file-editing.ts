/**
 * Editing a file in place.
 *
 * The file view switches into editing rather than hosting a separate editor
 * component, so this owns the editor instance, the dirty buffer, saving, and
 * the one command the library does not provide.
 *
 * Three constraints shape it. The editable view snapshots the rendered code
 * when the editor attaches, so an asynchronous worker highlight landing
 * afterwards never reaches it — hence `disableWorkerPool`, with `useLangReady`
 * priming the main-thread highlighter so the first paint is coloured. The live
 * buffer is mirrored here rather than read back out of the DOM, so saving and
 * diagnostics both see exactly what the user is looking at. And the editor's
 * own keymap is left to do its job: everything this hook binds on `window` has
 * to be something the editor has no command for, or ⌘/ and friends would be
 * stopped on their way down to it.
 */
import { type FileContents } from "@pierre/diffs";
import { Editor, type EditorOptions } from "@pierre/diffs/edit";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  EDITOR_KEYMAP,
  LANGUAGE_COMMENTS,
  caretAfterDelete,
  deleteLinesEdits,
} from "@/components/editor/editor-commands";
import { fetchClient } from "@/lib/api/client";

/** How long typing settles before the buffer is handed to the analyser. */
const DIAGNOSTICS_DEBOUNCE_MS = 600;

export interface FileEditing {
  /**
   * The live editor, or null whenever there is no open edit session.
   *
   * The view owns the moment of creation: `File` calls the factory below when
   * it opens a session, rather than being handed an instance that existed
   * whether or not anyone was editing. Everything reading the buffer copes with
   * there not being one.
   */
  readonly editor: Editor<undefined> | null;
  /**
   * Hands the editable view an editor built to its specification. Given to
   * `EditProvider`; `File` calls it with the options for the session it is
   * opening, and this adds the ones this hook needs to mirror the buffer.
   */
  readonly createEditor: (
    options: EditorOptions<undefined>
  ) => Editor<undefined>;
  /**
   * Subscribe to buffer changes. The editor keeps a single `onChange`, and
   * `setOptions` merges by key — so a second feature registering its own would
   * silently replace this one's. Everything that needs to react goes here.
   */
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * Whether the caret is in the code right now. Anything binding a key on
   * `window` that the editor would also answer has to ask first — otherwise it
   * fires while the user is typing in the find bar or a comment composer.
   */
  readonly isFocused: () => boolean;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly save: () => void;
  /** Throw the unsaved buffer away and go back to what is on disk. */
  readonly discard: () => void;
  /**
   * The buffer to analyse: null while it matches what was loaded, so the
   * analyser reads the file from disk instead of being handed a copy of it.
   */
  readonly bufferForAnalysis: string | null;
}

export function useFileEditing(
  path: string,
  loadedContents: string | undefined,
  onSaved: () => void,
  /** Whether the view is in editing mode, so a closed session drops its editor. */
  editing: boolean = true
): FileEditing {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bufferForAnalysis, setBufferForAnalysis] = useState<string | null>(
    null
  );

  // The editor owns the live buffer once attached; these mirror it so saving
  // never has to read the DOM back.
  const valueRef = useRef("");
  const originalRef = useRef("");
  const saveRef = useRef<() => void>(() => {});
  const focusedRef = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeners = useRef(new Set<() => void>());

  const [editor, setEditor] = useState<Editor<undefined> | null>(null);

  /**
   * Build the editor the view asked for, with this hook's own listeners folded
   * in and the app's editing configuration on top.
   *
   * The view's options come first so ours win: it merges by key, and a single
   * `onChange` is all an editor keeps — the buffer mirror, the dirty flag and
   * the debounced hand-off to the analyser all hang off ours. The view's own
   * callbacks are still called, so nothing it registered is lost.
   */
  const createEditor = useCallback((options: EditorOptions<undefined>) => {
    const created = new Editor<undefined>({
      ...options,
      // Comment tokens for the filetypes the library's own table misses, and
      // the bindings this app adds to its defaults.
      languageCommentConfig: {
        ...LANGUAGE_COMMENTS,
        ...options.languageCommentConfig,
      },
      keymap: [...EDITOR_KEYMAP, ...(options.keymap ?? [])],
      matchBrackets: options.matchBrackets ?? true,
      autoSurround: options.autoSurround ?? "default",
      onFocus: () => {
        focusedRef.current = true;
        options.onFocus?.();
      },
      onBlur: () => {
        focusedRef.current = false;
        options.onBlur?.();
      },
      onChange: (file: FileContents, annotations, event) => {
        valueRef.current = file.contents;
        setDirty(file.contents !== originalRef.current);
        for (const listener of listeners.current) listener();
        options.onChange?.(file, annotations, event);
        if (debounce.current !== null) clearTimeout(debounce.current);
        debounce.current = setTimeout(() => {
          // Analysing every keystroke would rebuild the program mid-word; a
          // pause is the natural moment to re-check.
          setBufferForAnalysis(
            file.contents === originalRef.current ? null : file.contents
          );
        }, DIAGNOSTICS_DEBOUNCE_MS);
      },
    });
    setEditor(created);
    return created;
  }, []);

  // The editor belongs to the session the view opened, so it is torn down with
  // it rather than with this hook.
  useEffect(() => {
    if (editor === null) return;
    return () => {
      if (debounce.current !== null) clearTimeout(debounce.current);
      editor.cleanUp();
    };
  }, [editor]);

  // A closed session leaves nothing behind. `File` unmounts with the session
  // and never calls the factory again, so an editor kept past it is a detached
  // one — and everything downstream reads "there is an editor" as "there is a
  // caret and a buffer to act on".
  useEffect(() => {
    if (!editing) {
      focusedRef.current = false;
      setEditor(null);
    }
  }, [editing]);

  // Reseed the mirrors whenever the file (re)loads. The view re-keys `File` by
  // path, so the editor itself reseeds on navigation.
  useEffect(() => {
    if (loadedContents === undefined) return;
    valueRef.current = loadedContents;
    originalRef.current = loadedContents;
    setDirty(false);
    setBufferForAnalysis(null);
  }, [loadedContents]);

  const save = useCallback(async () => {
    if (valueRef.current === originalRef.current) return;
    setSaving(true);
    try {
      const { error } = await fetchClient.PUT("/api/file", {
        body: { path, contents: valueRef.current },
      });
      if (error)
        throw new Error((error as { reason?: string }).reason ?? "save failed");
      originalRef.current = valueRef.current;
      setDirty(false);
      setBufferForAnalysis(null);
      toast.success("Saved");
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [path, onSaved]);
  saveRef.current = () => void save();

  /**
   * Delete the lines the selection touches — the one IDE staple the library has
   * no command for. Everything else it does have (comment, block comment, move
   * and copy line, indent, document ends) is bound in its own keymap and must
   * be left to reach it.
   */
  const deleteLines = useCallback(() => {
    if (editor === null) return;
    const selections = editor.getState().selections ?? [];
    if (selections.length === 0) return;
    const lines = editor.getText().split("\n");
    const targeted = new Set<number>();
    for (const sel of selections) {
      const lo = Math.min(sel.start.line, sel.end.line);
      const hiRaw = Math.max(sel.start.line, sel.end.line);
      // A selection ending at column 0 doesn't include that trailing line.
      const hi = sel.end.character === 0 && hiRaw > lo ? hiRaw - 1 : hiRaw;
      for (let n = lo; n <= hi && n < lines.length; n++) targeted.add(n);
    }
    const lineNums = [...targeted].sort((a, b) => a - b);
    if (lineNums.length === 0) return;
    const edits = deleteLinesEdits(lines, lineNums);
    if (edits.length === 0) return;
    editor.applyEdits(edits, true);
    // The remap after a deletion leaves the caret at the seam; an IDE puts it
    // at the start of the line that moved up, ready for the next ⌘⇧K.
    const caret = caretAfterDelete(lines, lineNums);
    editor.setSelections([{ start: caret, end: caret, direction: "none" }]);
  }, [editor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      // Saving belongs to the file, not to the caret: ⌘S from the tab strip or
      // the find bar still writes what is on screen.
      if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        saveRef.current();
        return;
      }
      if (!focusedRef.current) return;
      if (event.shiftKey && key === "k") {
        // Capture, prevent, stop — nothing below binds ⌘⇧K, but the editor
        // would take the keystroke as text if it reached the caret.
        event.preventDefault();
        event.stopPropagation();
        deleteLines();
      }
    };
    // Capture phase so this is decided before the keystroke reaches the code.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deleteLines]);

  const discard = useCallback(() => {
    valueRef.current = originalRef.current;
    setDirty(false);
    setBufferForAnalysis(null);
  }, []);

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  return {
    editor,
    createEditor,
    subscribe,
    isFocused: useCallback(() => focusedRef.current, []),
    dirty,
    saving,
    save: useCallback(() => void save(), [save]),
    discard,
    bufferForAnalysis,
  };
}
