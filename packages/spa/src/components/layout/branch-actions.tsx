/**
 * The actions a branch offers, shared by the compact top-bar menu and the
 * branches dock. The two surfaces arrange branches differently, but acting on
 * one must mean the same thing in both places — including following another
 * repository before the action and using the same create/rename/delete dialogs.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  IconGitCompare,
  IconGitFork,
  IconGitMerge,
  IconPlus,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { heldElsewhere } from "@/interactions/worktrees/functions/worktrees.functions";
import { useWorktreeActions } from "@/interactions/worktrees/adapters/worktrees.hook.adapter";
import { useStatus, useWorkspace, useWorktrees } from "@/lib/queries";
import { REVIEW_HREF } from "@/lib/shell-route";
import type { Worktree } from "@byconvo/core/repo";

export interface BranchActionTarget {
  /** Full display name, e.g. "task/BMB-207" or "origin/feature". */
  readonly display: string;
  /** The ref to check out — a local name, or a remote's short tracking name. */
  readonly ref: string;
  readonly isCurrent: boolean;
  readonly isRemote: boolean;
}

export interface BranchActionScope {
  /** Null means the repository the git views already follow. */
  readonly repoPath: string | null;
  /** Checked-out branch in this repository, used by compare/merge/rebase copy. */
  readonly head: string;
}

export interface BranchActionControlProps {
  readonly busy: boolean;
  readonly currentRepoPath: string | null;
  readonly onFollowRepo?: (repoPath: string) => Promise<boolean>;
  readonly onCheckout: (ref: string) => void;
  readonly onCheckoutAndUpdate: (ref: string) => void;
  readonly onCreateBranch: (name: string, startPoint: string | null) => void;
  readonly onCompare: (base: string, head: string) => void;
  readonly onMerge: (branch: string) => void;
  readonly onRebase: (onto: string) => void;
  readonly onFetch: () => void;
  readonly onPush: () => void;
  readonly onRenameBranch: (from: string, to: string) => void;
  readonly onDeleteBranch: (name: string) => void;
}

type BranchPrompt =
  | {
      readonly kind: "create";
      readonly startPoint: string | null;
      readonly label: string;
      readonly repoPath: string | null;
    }
  | {
      readonly kind: "rename";
      readonly from: string;
      readonly repoPath: string | null;
    }
  | {
      readonly kind: "delete";
      readonly name: string;
      readonly repoPath: string | null;
    };

/** Branch names make these labels long; the menu item clips them deliberately. */
const ActionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="min-w-0 flex-1 truncate">{children}</span>
);

/**
 * One action controller per branch surface. It owns only transient prompts;
 * the git mutations themselves stay with the caller's shared action adapter.
 */
export function useBranchActionControls(props: BranchActionControlProps) {
  const [prompt, setPrompt] = useState<BranchPrompt | null>(null);
  // The worktrees are the same question wherever a branch is listed, and no
  // caller has an answer of its own to give — so they are read here rather
  // than threaded through every surface that shows a branch.
  const workspace = useWorkspace();
  const worktrees = useWorktrees().data ?? [];
  const status = useStatus();
  const parallel = useWorktreeActions();
  const navigate = useNavigate();

  /**
   * Finish a task: stand where the target branch is checked out, then merge the
   * branch you were on into it. Git merges into whatever HEAD it finds, so the
   * move has to come first — and it is only offered when a worktree already
   * holds the target, which is the case where nothing has to be checked out and
   * the branch you are leaving stays exactly where it was.
   *
   * Conflicts arrive in the merge state the app already reads, so landing needs
   * no resolution of its own.
   */
  /**
   * The worktrees read here are the selected repository's, so landing is only
   * itself when the branch being landed belongs to that same repository — in a
   * project of several roots, another root's section is answering about a
   * checkout this list knows nothing about.
   */
  const isCurrentRepo = (scope: BranchActionScope) =>
    scope.repoPath === null || scope.repoPath === props.currentRepoPath;

  const land = (head: string, into: Worktree) => {
    // Landing merges commits. Anything still only in the working tree would be
    // left behind in a worktree whose whole purpose is now over — the one way
    // this flow can quietly lose work.
    if ((status.data?.changed ?? 0) > 0) {
      toast.error(
        `Commit your work on ‘${head}’ first — landing merges commits, not the working tree.`
      );
      return;
    }
    void parallel
      .focus(into.path, workspace.data?.current ?? null)
      .then(() => props.onMerge(head));
  };

  const runInRepo = (repoPath: string | null, action: () => void) => {
    if (repoPath === null || repoPath === props.currentRepoPath) {
      action();
      return;
    }
    const following = props.onFollowRepo?.(repoPath);
    if (following === undefined) return;
    void following.then((ok) => {
      if (ok) action();
    });
  };

  const actionItems = (
    target: BranchActionTarget,
    scope: BranchActionScope
  ) => {
    const elsewhere = target.isRemote
      ? null
      : heldElsewhere(worktrees, target.ref);
    return (
      <>
        {/* A branch git already has open somewhere cannot be checked out again —
          git refuses it — and going to where it lives is what was meant. */}
        {elsewhere !== null ? (
          <DropdownMenuItem
            onClick={() =>
              void parallel.focus(
                elsewhere.path,
                workspace.data?.current ?? null
              )
            }
          >
            <IconGitFork className="size-3.5 text-muted-foreground" />
            <ActionLabel>Open in ‘{elsewhere.name}’</ActionLabel>
          </DropdownMenuItem>
        ) : (
          !target.isCurrent && (
            <DropdownMenuItem
              onClick={() =>
                runInRepo(scope.repoPath, () => props.onCheckout(target.ref))
              }
            >
              Checkout
            </DropdownMenuItem>
          )
        )}
        {elsewhere === null && !target.isRemote && !target.isCurrent && (
          <DropdownMenuItem
            onClick={() =>
              runInRepo(scope.repoPath, () => {
                void parallel.cut(target.ref, scope.head).then((worktree) => {
                  if (worktree === null) return;
                  // Nothing moved, so nothing on screen would otherwise say it
                  // worked — and where the work now is, is the fact worth
                  // having.
                  toast.success(
                    `‘${target.display}’ is open in worktree ‘${worktree.name}’`
                  );
                });
              })
            }
          >
            <IconGitFork className="size-3.5 text-muted-foreground" />
            <ActionLabel>Work on ‘{target.display}’ in parallel</ActionLabel>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            setPrompt({
              kind: "create",
              startPoint: target.ref,
              label: target.display,
              repoPath: scope.repoPath,
            })
          }
        >
          <IconPlus className="size-3.5 text-muted-foreground" />
          <ActionLabel>New Branch from ‘{target.display}’</ActionLabel>
        </DropdownMenuItem>
        {!target.isCurrent && (
          <>
            {/* Same refusal as plain checkout: a branch open in another
              worktree cannot be brought into this one. */}
            {elsewhere === null && (
              <DropdownMenuItem
                onClick={() =>
                  runInRepo(scope.repoPath, () =>
                    props.onCheckoutAndUpdate(target.ref)
                  )
                }
              >
                Checkout and Update
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                runInRepo(scope.repoPath, () =>
                  props.onCompare(scope.head, target.ref)
                )
              }
            >
              <ActionLabel>Compare with ‘{scope.head}’</ActionLabel>
            </DropdownMenuItem>
            {/* The finish line: the branch you are on, read against what it is
              aimed at — everything since the merge base, uncommitted work
              included. Aiming is remembered, so the next read needs no menu. */}
            <DropdownMenuItem
              onClick={() =>
                runInRepo(scope.repoPath, () => {
                  void parallel.aim(scope.head, target.ref);
                  void navigate({
                    to: REVIEW_HREF,
                    search: { target: target.ref },
                  });
                })
              }
            >
              <IconGitCompare className="size-3.5 text-muted-foreground" />
              <ActionLabel>
                Review ‘{scope.head}’ against ‘{target.display}’
              </ActionLabel>
            </DropdownMenuItem>
            {/* The other end of the same finish line. Reviewing says whether
              the task is done; this is what does something about it, and it
              goes the direction the task actually travels — out of the worktree
              it was done in, into the one that holds what it was aimed at. */}
            {elsewhere !== null && isCurrentRepo(scope) && (
              <DropdownMenuItem onClick={() => land(scope.head, elsewhere)}>
                <IconGitMerge className="size-3.5 text-muted-foreground" />
                <ActionLabel>
                  Land ‘{scope.head}’ into ‘{target.display}’
                </ActionLabel>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() =>
                runInRepo(scope.repoPath, () => props.onMerge(target.ref))
              }
            >
              <ActionLabel>
                Merge ‘{target.display}’ into ‘{scope.head}’
              </ActionLabel>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                runInRepo(scope.repoPath, () => props.onRebase(target.ref))
              }
            >
              <ActionLabel>
                Rebase ‘{scope.head}’ onto ‘{target.display}’
              </ActionLabel>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={props.busy}
          onClick={() => runInRepo(scope.repoPath, props.onFetch)}
        >
          Update
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={props.busy}
          onClick={() => runInRepo(scope.repoPath, props.onPush)}
        >
          Push…
        </DropdownMenuItem>
        {!target.isRemote && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setPrompt({
                  kind: "rename",
                  from: target.ref,
                  repoPath: scope.repoPath,
                })
              }
            >
              Rename…
            </DropdownMenuItem>
            {/* A branch a worktree still holds is not deletable — git keeps it
              for the tree that is on it, so the worktree is what has to go. */}
            {!target.isCurrent && elsewhere === null && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  setPrompt({
                    kind: "delete",
                    name: target.ref,
                    repoPath: scope.repoPath,
                  })
                }
              >
                Delete
              </DropdownMenuItem>
            )}
          </>
        )}
      </>
    );
  };

  const dialog = (
    <BranchPromptDialog
      prompt={prompt}
      onClose={() => setPrompt(null)}
      onCreateBranch={(name, startPoint) =>
        runInRepo(prompt?.repoPath ?? null, () =>
          props.onCreateBranch(name, startPoint)
        )
      }
      onRenameBranch={(from, to) =>
        runInRepo(prompt?.repoPath ?? null, () =>
          props.onRenameBranch(from, to)
        )
      }
      onDeleteBranch={(name) =>
        runInRepo(prompt?.repoPath ?? null, () => props.onDeleteBranch(name))
      }
    />
  );

  return {
    actionItems,
    dialog,
    checkout: (target: BranchActionTarget, scope: BranchActionScope) =>
      runInRepo(scope.repoPath, () => props.onCheckout(target.ref)),
    createBranch: (repoPath: string | null) =>
      setPrompt({
        kind: "create",
        startPoint: null,
        label: "",
        repoPath,
      }),
    fetch: (repoPath: string | null) => runInRepo(repoPath, props.onFetch),
    push: (repoPath: string | null) => runInRepo(repoPath, props.onPush),
  };
}

function BranchPromptDialog({
  prompt,
  onClose,
  onCreateBranch,
  onRenameBranch,
  onDeleteBranch,
}: {
  prompt: BranchPrompt | null;
  onClose: () => void;
  onCreateBranch: (name: string, startPoint: string | null) => void;
  onRenameBranch: (from: string, to: string) => void;
  onDeleteBranch: (name: string) => void;
}) {
  return (
    <Dialog open={prompt !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false}>
        {prompt?.kind === "delete" ? (
          <DeleteConfirm
            name={prompt.name}
            onConfirm={() => {
              onDeleteBranch(prompt.name);
              onClose();
            }}
          />
        ) : prompt !== null ? (
          <BranchNameForm
            key={prompt.kind === "rename" ? prompt.from : prompt.kind}
            prompt={prompt}
            onSubmit={(value) => {
              if (prompt.kind === "create") {
                onCreateBranch(value, prompt.startPoint);
                onClose();
                return;
              }
              if (prompt.kind === "rename" && value !== prompt.from) {
                onRenameBranch(prompt.from, value);
              }
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const promptCopy = (prompt: BranchPrompt) => {
  switch (prompt.kind) {
    case "create":
      return prompt.startPoint === null
        ? {
            title: "New branch",
            label: "Branch name",
            action: "Create",
            initial: "",
          }
        : {
            title: `New branch from ‘${prompt.label}’`,
            label: "Branch name",
            action: "Create",
            initial: "",
          };
    case "rename":
      return {
        title: `Rename ‘${prompt.from}’`,
        label: "New name",
        action: "Rename",
        initial: prompt.from,
      };
    default:
      return { title: "", label: "", action: "", initial: "" };
  }
};

function BranchNameForm({
  prompt,
  onSubmit,
}: {
  prompt: BranchPrompt;
  onSubmit: (value: string) => void;
}) {
  const copy = promptCopy(prompt);
  const [value, setValue] = useState(copy.initial);
  const trimmed = value.trim();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.label}</DialogDescription>
      </DialogHeader>
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={copy.label}
        className="my-4"
      />
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={trimmed.length === 0}>
          {copy.action}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteConfirm({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete branch</DialogTitle>
        <DialogDescription>
          Delete branch ‘{name}’? This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </DialogFooter>
    </>
  );
}
