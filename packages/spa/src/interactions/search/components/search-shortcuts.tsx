import { useSearchShortcuts } from "../adapters/search.hook.adapter";

interface SearchShortcutsProps {
  /** ⌘K — opens the dialog on its command list. */
  onOpenCommands: () => void;
  /** Shift, tapped twice — opens the dialog straight into the file search. */
  onOpenFiles: () => void;
  /** ⌘⇧F — opens the dialog straight into the content search. */
  onOpenText: () => void;
}

/** Renders nothing; owns the three global search gestures for the shell. */
export function SearchShortcuts(props: SearchShortcutsProps) {
  useSearchShortcuts(props);
  return null;
}
