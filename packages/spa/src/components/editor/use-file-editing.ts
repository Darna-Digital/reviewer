/**
 * Editing a file in place.
 *
 * A file in browse mode is editable the moment it opens — there is no mode to
 * switch into, so this owns the editor instance, the dirty buffer, saving, and
 * the one command the library does not provide, for as long as the file is on
 * screen.
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
import { type File as EditableFile, type FileContents } from "@pierre/diffs";
import type { TextEdit } from "@reviewer/core/language";
import {
  Editor,
  type EditorOptions,
  type EditorType,
} from "@pierre/diffs/edit";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  EDITOR_KEYMAP,
  LANGUAGE_COMMENTS,
  caretAfterDelete,
  deleteLinesEdits,
} from "@/components/editor/editor-commands";
import { minimalEdit } from "@/interactions/formatting/functions/format-edit";
import { fetchClient } from "@/lib/api/client";

/** How long typing settles before the buffer is handed to the analyser. */
const DIAGNOSTICS_DEBOUNCE_MS = 600;

export interface FileEditing {
  /**
   * The live editor, or null until the view has built one.
   *
   * The view owns the moment of creation: `File` calls the factory below as it
   * mounts. Everything reading the buffer copes with there not being one yet,
   * and with it going away when the file does.
   */
  readonly editor: Editor<"file"> | null;
  /**
   * Hands the editable view an editor built to its specification. Given to
   * `EditProvider`; `File` calls it with the options for the session it is
   * opening, and this adds the ones this hook needs to mirror the buffer.
   */
  readonly createEditor: <EType extends EditorType>(
    editorType: EType,
    options: EditorOptions<EType, undefined, undefined>,
    editStateKey?: string
  ) => Editor<EType, undefined, undefined>;
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
  /**
   * What the editor is holding right now, or null before one is attached.
   *
   * The view reads this to tell a genuinely new document from a re-read that
   * only says back what was just written — see `CodeView`.
   */
  readonly readBuffer: () => string | null;
  /**
   * Replace the buffer with `text`, as the smallest edit that gets there.
   *
   * For a second view over the same file — the document editor beside a split
   * markdown file. Applying an edit rather than resetting the document is what
   * keeps the caret, the selection and the undo history intact on the side the
   * user is not typing in.
   */
  readonly replaceBuffer: (text: string) => void;
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

export interface FileEditingOptions {
  /** Repository-relative path of the file being edited. */
  readonly path: string;
  /**
   * Whether the view is holding an edit session open. False in comment mode,
   * where the file is read rather than written: the session is torn down and
   * the editor with it, so everything that reaches for one — folding, find,
   * the caret — has to be told there is no longer one to reach for.
   */
  readonly editing: boolean;
  /** What was loaded from disk, or undefined while it is still being read. */
  readonly loadedContents: string | undefined;
  /** Called after the buffer is written back, so git state can refresh. */
  readonly onSaved: () => void;
  /**
   * Called with the file component the editor attached to. It is the only way
   * to reach the optional collapsed-region hooks a plain file leaves
   * unimplemented — see `useFolding`.
   */
  readonly onAttach?: (component: EditableFile<undefined, undefined>) => void;
  /**
   * Run the project's formatter over the buffer on its way to disk, answering
   * with the text to write and the edit that brings the buffer to it. Omit to
   * save exactly what the user typed.
   */
  readonly formatBeforeSave?: (
    path: string,
    contents: string
  ) => Promise<{ readonly contents: string; readonly edit: TextEdit | null }>;
  /**
   * Build the popover the editor floats over a user-made selection. The editor
   * owns when it appears and where; this only says what it is.
   */
  readonly renderSelectionAction?: (
    context: SelectionActionContext
  ) => HTMLElement;
}

/** What the selection popover is given to work with. */
export interface SelectionActionContext {
  readonly selection: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly getSelectionText: () => string;
  readonly close: () => void;
}

export function useFileEditing({
  path,
  editing,
  loadedContents,
  onSaved,
  onAttach,
  formatBeforeSave,
  renderSelectionAction,
}: FileEditingOptions): FileEditing {
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

  /**
   * The editor, together with the file it was built for. The view builds one as
   * it mounts, and whether that happens before or after this hook's own effects
   * is not something either side controls — a file already in the cache renders
   * in the same commit the hook mounts in, and one still being read does not.
   * Pairing the instance with its path settles the question by construction:
   * an editor belongs to the file it was made for and to no other, so there is
   * never a right moment to throw one away.
   */
  const [attachment, setAttachment] = useState<{
    readonly path: string;
    readonly editor: Editor<"file">;
  } | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;
  // The view disposes the editor itself when editing stops, so an attachment
  // that outlives the session names something already torn down.
  const editor =
    editing && attachment !== null && attachment.path === path
      ? attachment.editor
      : null;

  /**
   * Build the editor the view asked for, with this hook's own listeners folded
   * in and the app's editing configuration on top.
   *
   * The view's options come first so ours win: it merges by key, and a single
   * `onChange` is all an editor keeps — the buffer mirror, the dirty flag and
   * the debounced hand-off to the analyser all hang off ours. The view's own
   * callbacks are still called, so nothing it registered is lost.
   */
  const attachRef = useRef(onAttach);
  attachRef.current = onAttach;
  const selectionActionRef = useRef(renderSelectionAction);
  selectionActionRef.current = renderSelectionAction;

  const createEditor = useCallback(
    <EType extends EditorType>(
      editorType: EType,
      options: EditorOptions<EType, undefined, undefined>,
      editStateKey?: string
    ) => {
      const created = new Editor<EType, undefined, undefined>(
        editorType,
        {
          ...options,
          onAttach: (attached, component) => {
            attachRef.current?.(
              component as EditableFile<undefined, undefined>
            );
            options.onAttach?.(attached, component);
          },
          // Comment tokens for the filetypes the library's own table misses, and
          // the bindings this app adds to its defaults.
          languageCommentConfig: {
            ...LANGUAGE_COMMENTS,
            ...options.languageCommentConfig,
          },
          keymap: [...EDITOR_KEYMAP, ...(options.keymap ?? [])],
          matchBrackets: options.matchBrackets ?? true,
          autoSurround: options.autoSurround ?? "default",
          // The editor decides when a selection is the user's rather than the
          // app's, and keeps the popover positioned and torn down; all this
          // supplies is the element.
          enabledSelectionAction: selectionActionRef.current !== undefined,
          renderSelectionAction: (context) =>
            selectionActionRef.current?.({
              selection: context.selection,
              getSelectionText: context.getSelectionText,
              close: context.close,
            }) ?? document.createElement("span"),
          onFocus: () => {
            focusedRef.current = true;
            options.onFocus?.();
          },
          onBlur: () => {
            focusedRef.current = false;
            options.onBlur?.();
          },
          onChange: (event) => {
            const file: FileContents = event.file;
            valueRef.current = file.contents;
            setDirty(file.contents !== originalRef.current);
            for (const listener of listeners.current) listener();
            options.onChange?.(event);
            if (debounce.current !== null) clearTimeout(debounce.current);
            debounce.current = setTimeout(() => {
              // Analysing every keystroke would rebuild the program mid-word; a
              // pause is the natural moment to re-check.
              setBufferForAnalysis(
                file.contents === originalRef.current ? null : file.contents
              );
            }, DIAGNOSTICS_DEBOUNCE_MS);
          },
        },
        editStateKey
      );
      setAttachment({
        path: pathRef.current,
        editor: created as Editor<"file">,
      });
      return created;
    },
    []
  );

  // The editor belongs to the session the view opened, so it is torn down with
  // it rather than with this hook.
  useEffect(() => {
    const instance = attachment?.editor;
    if (instance === undefined) return;
    return () => {
      if (debounce.current !== null) clearTimeout(debounce.current);
      instance.cleanUp();
    };
  }, [attachment]);

  // A file swapped underneath leaves the caret behind with the view it was in.
  useEffect(() => {
    focusedRef.current = false;
  }, [path]);

  // Reseed the mirrors whenever the file (re)loads. The view re-keys `File` by
  // path, so the editor itself reseeds on navigation.
  useEffect(() => {
    if (loadedContents === undefined) return;
    valueRef.current = loadedContents;
    originalRef.current = loadedContents;
    setDirty(false);
    setBufferForAnalysis(null);
  }, [loadedContents]);

  /**
   * The buffer as it should be written: formatted, if the project formats and
   * the editor is there to take the result.
   *
   * Two things it refuses to do. It never writes formatted text the editor does
   * not also hold — the file on disk and the buffer on screen would disagree,
   * and the tab would go clean over a document nobody had seen. And it drops a
   * result that arrived about a buffer the user has since typed past: the edit
   * was computed against text that no longer exists, so what is on screen now
   * is saved instead, unformatted.
   */
  const formatRef = useRef(formatBeforeSave);
  formatRef.current = formatBeforeSave;
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const contentsToWrite = useCallback(async () => {
    const format = formatRef.current;
    const instance = editorRef.current;
    const requested = valueRef.current;
    if (format === undefined || instance === null) return requested;
    const outcome = await format(path, requested);
    if (outcome.edit === null || valueRef.current !== requested)
      return valueRef.current;
    instance.applyEdits([outcome.edit], true);
    return outcome.contents;
  }, [path]);

  const save = useCallback(async () => {
    if (valueRef.current === originalRef.current) return;
    setSaving(true);
    try {
      const contents = await contentsToWrite();
      const { error } = await fetchClient.PUT("/api/file", {
        body: { path, contents },
      });
      if (error)
        throw new Error((error as { reason?: string }).reason ?? "save failed");
      originalRef.current = contents;
      // What went to disk is what the buffer held when the write started, and
      // typing does not stop for a network round trip: a keystroke that landed
      // in between leaves the file dirty again the moment it is saved. Marking
      // it clean regardless would take the tab's marker off a document that no
      // longer matches what is on disk.
      const settled = valueRef.current === contents;
      setDirty(!settled);
      setBufferForAnalysis(settled ? null : valueRef.current);
      toast.success("Saved");
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }, [path, onSaved, contentsToWrite]);
  saveRef.current = () => void save();

  /**
   * Delete the lines the selection touches — the one IDE staple the library has
   * no command for. Everything else it does have (comment, block comment, move
   * and copy line, indent, document ends) is bound in its own keymap and must
   * be left to reach it.
   */
  const deleteLines = useCallback(() => {
    if (editor === null) return;
    const selections = editor.getViewState().selections ?? [];
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

  const replaceBuffer = useCallback((text: string) => {
    const instance = editorRef.current;
    if (instance === null) return;
    const edit = minimalEdit(valueRef.current, text);
    if (edit === null) return;
    instance.applyEdits([edit], true);
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
    readBuffer: useCallback(
      () => (editor === null ? null : valueRef.current),
      [editor]
    ),
    replaceBuffer,
    dirty,
    saving,
    save: useCallback(() => void save(), [save]),
    discard,
    bufferForAnalysis,
  };
}
