/**
 * SearchHost — mounts the search dialog and its keyboard gestures for a shell,
 * so ⌘K, ⇧⇧ and ⌘⇧F work on every code-mode page rather than only on the ones
 * that show a diff. What it offers is assembled here: the code-mode commands,
 * whatever the mounted pages registered, and the repository's file list.
 *
 * A result opens where it can be read — in place when the page already shows
 * files, otherwise on the local-changes page.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useFiles } from "@/lib/queries";
import { useCodeCommands } from "../adapters/code-commands.hook.adapter";
import {
  openSearch,
  setSearchMode,
  setSearchOpen,
  toggleCommandSearch,
  useRegisteredCommands,
  useSearchState,
} from "../adapters/search.store";
import {
  FILE_FALLBACK_ROUTE,
  opensFileInPlace,
} from "../functions/navigation.functions";
import { SearchDialog } from "./search-dialog";
import { SearchShortcuts } from "./search-shortcuts";

interface FileLocation {
  file: string;
  line?: number;
}

export function SearchHost() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open, mode } = useSearchState();
  const codeCommands = useCodeCommands();
  const pageCommands = useRegisteredCommands();
  const files = useFiles();

  const commands = useMemo(
    () => [...codeCommands, ...pageCommands],
    [codeCommands, pageCommands]
  );

  const show = (location: FileLocation) => {
    if (opensFileInPlace(pathname)) {
      void navigate({
        to: ".",
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          ...location,
        }),
      });
      return;
    }
    void navigate({ to: FILE_FALLBACK_ROUTE, search: location });
  };

  return (
    <>
      <SearchShortcuts
        onOpenCommands={toggleCommandSearch}
        onOpenFiles={() => openSearch("files")}
        onOpenText={() => openSearch("text")}
      />
      <SearchDialog
        open={open}
        mode={mode}
        onOpenChange={setSearchOpen}
        onModeChange={setSearchMode}
        commands={commands}
        files={files.data?.paths ?? []}
        onOpenFile={(file) => show({ file })}
        onOpenLocation={(file, line) => show({ file, line })}
      />
    </>
  );
}
