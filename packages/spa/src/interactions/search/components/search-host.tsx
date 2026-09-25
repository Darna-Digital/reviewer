/**
 * SearchHost — mounts the search dialog for a shell, so it opens on every
 * code-mode page rather than only on the ones that show a diff. What it offers
 * is assembled here: the code-mode commands,
 * whatever the mounted pages registered, the file list of the project (every
 * root it holds) or of the one repository it is, and the branches for the
 * checkout list.
 *
 * A file result always opens in its own tab on the browse page, whichever page
 * the search was opened from — a diff shows the change, not files.
 */
import { useMemo } from "react";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useOpenBrowseTab } from "@/interactions/tabs/adapters/open-browse-tab.hook.adapter";
import { useBranches, useFiles, useRemoteBranches } from "@/lib/queries";
import { useCodeCommands } from "../adapters/code-commands.hook.adapter";
import {
  setSearchMode,
  setSearchOpen,
  useRegisteredCommands,
  useSearchState,
} from "../adapters/search.store";
import { branchChoices } from "../functions/palette.functions";
import { SearchDialog } from "./search-dialog";

export function SearchHost() {
  const openBrowseTab = useOpenBrowseTab();
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
        onOpenFile={(file) => openBrowseTab(file)}
        onOpenLocation={openBrowseTab}
        onCheckout={(ref) => void git.checkout(ref)}
      />
    </>
  );
}
