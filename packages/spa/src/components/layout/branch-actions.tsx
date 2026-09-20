/**
 * The actions a branch offers, shared by the compact top-bar menu and the
 * branches dock. The two surfaces arrange branches differently, but acting on
 * one must mean the same thing in both places, down to the same
 * create/rename/delete dialogs.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { IconGitCompare, IconPlus } from "@tabler/icons-react";
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
import { useBranchTargetActions } from "@/interactions/branch-targets/adapters/branch-targets.hook.adapter";
import { REVIEW_HREF } from "@/lib/shell-route";

export interface BranchActionTarget {
  /** Full display name, e.g. "task/BMB-207" or "origin/feature". */
  readonly display: string;
  /** The ref to check out — a local name, or a remote's short tracking name. */
  readonly ref: string;
  readonly isCurrent: boolean;
  readonly isRemote: boolean;
}

export interface BranchActionScope {
  /** The checked-out branch, used by compare/merge/rebase copy. */
  readonly head: string;
}

export interface BranchActionControlProps {
  readonly busy: boolean;
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
    }
  | { readonly kind: "rename"; readonly from: string }
  | { readonly kind: "delete"; readonly name: string };

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
  const targets = useBranchTargetActions();
  const navigate = useNavigate();

  const actionItems = (
    target: BranchActionTarget,
    scope: BranchActionScope
  ) => {
    return (
      <>
        {!target.isCurrent && (
          <DropdownMenuItem onClick={() => props.onCheckout(target.ref)}>
            Checkout
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            setPrompt({
              kind: "create",
              startPoint: target.ref,
              label: target.display,
            })
          }
        >
          <IconPlus className="size-3.5 text-muted-foreground" />
          <ActionLabel>New Branch from ‘{target.display}’</ActionLabel>
        </DropdownMenuItem>
        {!target.isCurrent && (
          <>
            <DropdownMenuItem
              onClick={() => props.onCheckoutAndUpdate(target.ref)}
            >
              Checkout and Update
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => props.onCompare(scope.head, target.ref)}
            >
              <ActionLabel>Compare with ‘{scope.head}’</ActionLabel>
            </DropdownMenuItem>
            {/* The finish line: the branch you are on, read against what it is
              aimed at — everything since the merge base, uncommitted work
              included. Aiming is remembered, so the next read needs no menu. */}
            <DropdownMenuItem
              onClick={() => {
                void targets.aim(scope.head, target.ref);
                void navigate({
                  to: REVIEW_HREF,
                  search: { target: target.ref },
                });
              }}
            >
              <IconGitCompare className="size-3.5 text-muted-foreground" />
              <ActionLabel>
                Review ‘{scope.head}’ against ‘{target.display}’
              </ActionLabel>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onMerge(target.ref)}>
              <ActionLabel>
                Merge ‘{target.display}’ into ‘{scope.head}’
              </ActionLabel>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onRebase(target.ref)}>
              <ActionLabel>
                Rebase ‘{scope.head}’ onto ‘{target.display}’
              </ActionLabel>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={props.busy} onClick={() => props.onFetch()}>
          Update
        </DropdownMenuItem>
        <DropdownMenuItem disabled={props.busy} onClick={() => props.onPush()}>
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
                })
              }
            >
              Rename…
            </DropdownMenuItem>
            {!target.isCurrent && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  setPrompt({
                    kind: "delete",
                    name: target.ref,
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
        props.onCreateBranch(name, startPoint)
      }
      onRenameBranch={(from, to) => props.onRenameBranch(from, to)}
      onDeleteBranch={(name) => props.onDeleteBranch(name)}
    />
  );

  return {
    actionItems,
    dialog,
    checkout: (target: BranchActionTarget) => props.onCheckout(target.ref),
    createBranch: () =>
      setPrompt({ kind: "create", startPoint: null, label: "" }),
    fetch: () => props.onFetch(),
    push: () => props.onPush(),
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
