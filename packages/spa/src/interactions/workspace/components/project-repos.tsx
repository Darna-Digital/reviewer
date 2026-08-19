/**
 * The center pane for a project with nothing to review: a folder holding no
 * git repository at all. It names what was opened and offers the roots if any
 * turned up, so the app says why it is empty instead of showing a blank tree.
 */
import { IconFolder, IconGitBranch } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { folderName } from "@byconvo/core/workspace";
import { ProjectAvatar } from "./project-avatar";
import type { RepoEntry } from "@byconvo/core/workspace";

interface ProjectReposProps {
  project: string;
  repos: ReadonlyArray<RepoEntry>;
  onOpen: (path: string) => void;
}

export function ProjectRepos({ project, repos, onOpen }: ProjectReposProps) {
  return (
    <ScrollArea className="h-full" viewportClassName="scroll-fade">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-8">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium">
            <IconFolder className="size-4 text-muted-foreground" />
            {folderName(project)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {repos.length === 0
              ? "No git repository here. Open a repository, or a folder holding some."
              : `${repos.length} ${repos.length === 1 ? "repository" : "repositories"}`}
          </p>
        </div>
        {repos.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {repos.map((repo) => (
              <li key={repo.path}>
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg border p-3 text-left hover:bg-muted"
                  onClick={() => onOpen(repo.path)}
                >
                  <ProjectAvatar name={repo.name} className="size-7 text-xs" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-medium">
                      <IconGitBranch className="size-3.5 text-muted-foreground" />
                      {repo.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {repo.branch ?? "detached"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ScrollArea>
  );
}
