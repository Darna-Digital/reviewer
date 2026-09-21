/**
 * SearchHost — mounts the search dialog for a shell, so it opens on every
 * code-mode page rather than only on the ones that show a diff. What it offers
 * is assembled here: the code-mode commands,
 * whatever the mounted pages registered, the file list of the project (every
 * root it holds) or of the one repository it is, and the branches for the
 * checkout list.
 *
 * A result opens where it can be read — in place when the page already shows
 * files, otherwise on the local-changes page.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useBranches, useFiles, useRemoteBranches } from "@/lib/queries";
import { useCodeCommands } from "../adapters/code-commands.hook.adapter";
import {
  setSearchMode,
  setSearchOpen,
  useRegisteredCommands,
  useSearchState,
} from "../adapters/search.store";
import {
  FILE_FALLBACK_ROUTE,
  opensFileInPlace,
} from "../functions/navigation.functions";
import { branchChoices } from "../functions/palette.functions";
import { SearchDialog } from "./search-dialog";

interface FileLocation {
  file: string;
  line?: number;
}

export function SearchHost() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open, mode, seed } = useSearchState();
  const codeCommands = useCodeCommands();
  const pageCommands = useRegisteredCommands();
  const files = useFiles();
  const local = useBranches();
  const remote = useRemoteBranches();
  const git = useGitActions();

  const commands = useMemo(
    () => [...codeCommands, ...pageCommands],
    [codeCommands, pageCommands]
  );

  const branches = useMemo(
    () => branchChoices(local.data ?? [], remote.data ?? []),
    [local.data, remote.data]
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
      <SearchDialog
        open={open}
        mode={mode}
        onOpenChange={setSearchOpen}
        onModeChange={setSearchMode}
        seed={seed}
        commands={commands}
        files={files.data?.paths ?? []}
        branches={branches}
        onOpenFile={(file) => show({ file })}
        onOpenLocation={(file, line) => show({ file, line })}
        onCheckout={(ref) => void git.checkout(ref)}
      />
    </>
  );
}
