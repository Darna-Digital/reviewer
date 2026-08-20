import { useEffect, useState } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconGitBranch,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

import {
  Section,
  Specimen,
  SpecimenRow,
  Subsection,
} from "@/components/kitchen-sink/kitchen-sink-primitives";
import { Badge } from "@/components/ui/badge";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { Orb } from "@/components/ui/orb";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverDocumentation,
  TargetChoice,
  UsagesList,
} from "@/interactions/language/components/symbol-overlay";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { cn } from "@/lib/utils";

/** Enough of a hover, a usage list and a jump to judge the three side by side. */
const SYMBOL_HOVER = [
  "```ts",
  "(method) Repository.commit(message: string): Promise<Sha>",
  "```",
  "",
  "Records the staged changes and returns the new commit.",
  "",
  "*@throws* — when nothing is staged",
].join("\n");

/** A server that ships reference data — the CSS one — answering about `gap`. */
const SYMBOL_HOVER_CSS = [
  "The gap CSS property is a shorthand property for row-gap and column-gap",
  "specifying the gutters between grid rows and columns.",
  "",
  "[Learn more on MDN](https://developer.mozilla.org/docs/Web/CSS/gap)",
].join("\n");

const symbolLocation = (path: string, line: number) => ({
  path,
  range: {
    start: { line, character: 2 },
    end: { line, character: 8 },
  },
});

const SYMBOL_USAGES = [
  {
    location: symbolLocation("src/features/git/repository.ts", 41),
    kind: "definition" as const,
    preview: "async commit(message: string): Promise<Sha> {",
  },
  {
    location: symbolLocation("src/interactions/commit/commit-panel.tsx", 118),
    kind: "read" as const,
    preview: "const sha = await repository.commit(message);",
  },
  {
    location: symbolLocation("src/interactions/commit/commit-panel.tsx", 132),
    kind: "write" as const,
    preview: "repository.commit = withRetries(repository.commit);",
  },
];

const SYMBOL_TARGETS = [
  {
    location: symbolLocation("src/features/git/repository.ts", 41),
    name: "commit",
    kind: "method",
    containerName: "Repository",
    preview: "async commit(message: string): Promise<Sha> {",
  },
  {
    location: symbolLocation("src/features/git/repository.d.ts", 12),
    name: "commit",
    kind: "declaration",
    containerName: "Repository",
    preview: "commit(message: string): Promise<Sha>;",
  },
];

/**
 * A symbol card, held still. The real one floats off a token and is anchored to
 * it; what is worth comparing here is the surface and the layout, so the
 * specimen borrows the popup's own elevation and stays on the page.
 */
function SymbolCardSpecimen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { level, className } = useElevation(ELEVATION.menu, POPUP_SHADOW);
  return (
    <Specimen label={label}>
      <SurfaceProvider value={level}>
        <div
          className={cn(
            // Sized by its content, capped like the real popup, so the specimen
            // is the width the card actually opens at.
            "w-fit max-w-[min(40rem,100%)] overflow-hidden rounded-lg",
            className
          )}
        >
          {children}
        </div>
      </SurfaceProvider>
    </Specimen>
  );
}

const RADIO_CLASSES =
  "col-start-1 row-start-1 appearance-none rounded-full border border-border bg-background checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:border-border disabled:bg-muted disabled:checked:bg-muted dark:bg-white/5 dark:disabled:bg-white/10 forced-colors:appearance-auto";

const REVIEWERS = ["Anyone on the team", "Only me", "Nobody yet"];

const TOAST_MOCKS: readonly { label: string; fire: () => void }[] = [
  {
    label: "Success",
    fire: () => toast.success("Pushed to origin/master"),
  },
  {
    label: "Error",
    fire: () =>
      toast.error("Push rejected", {
        description: "The remote has commits you do not have.",
      }),
  },
  {
    label: "Warning",
    fire: () => toast.warning("Working tree has uncommitted changes"),
  },
  {
    label: "Info",
    fire: () =>
      toast.info("Branch is up to date", {
        description: "Nothing to fetch from origin.",
      }),
  },
  {
    label: "Plain",
    fire: () =>
      toast("Drafting a commit message", {
        icon: <IconSparkles className="size-4" />,
      }),
  },
  {
    label: "Loading",
    fire: () => toast.loading("Rebasing onto master…"),
  },
  {
    label: "With action",
    fire: () =>
      toast.error("Could not switch branch", {
        description: "Stash or commit your changes first.",
        action: { label: "Stash", onClick: () => toast.success("Stashed") },
      }),
  },
  {
    label: "Long line",
    fire: () =>
      toast.warning(
        "warning: fetch updated the current branch head. fast-forwarding your working tree from commit fb863a957b2935d84b7f1528cb862b4170f895e2."
      ),
  },
  {
    label: "Long + description",
    fire: () =>
      toast.error(
        "failed to push some refs to git@github.com:darna-digital/byconvo.git",
        {
          description:
            "Updates were rejected because the tip of your current branch is behind its remote counterpart. Integrate the remote changes (e.g. 'git pull --rebase') before pushing again. See the 'Note about fast-forwards' section of 'git push --help' for details.",
        }
      ),
  },
  {
    label: "Unbroken token",
    fire: () =>
      toast.error("Cannot resolve path", {
        description:
          "packages/spa/src/interactions/collaboration/components/announce-move-into-the-deepest-possible-directory.ts",
      }),
  },
  {
    label: "Stack of four",
    fire: () => {
      toast.success("Fetched origin");
      toast.info("Rebased 3 commits");
      toast.warning("1 file left conflicted");
      toast.error("Push rejected");
    },
  },
];

/** Remounts on a beat that shares no factor with the orb's, so the fresh orb
 *  lands on an arbitrary point of the cycle — it should still come up in step
 *  with the ones that have been running all along, never from rest. */
function LateOrb() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setGeneration((n) => n + 1), 1100);
    return () => clearInterval(timer);
  }, []);
  return <Orb key={generation} size={40} label="Working" />;
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      <label className="text-base font-medium sm:text-sm" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p className="text-sm/5 text-pretty text-muted-foreground sm:text-xs/5">
          {hint}
        </p>
      )}
    </div>
  );
}

function ChoiceRow({
  children,
  label,
  htmlFor,
}: {
  children: React.ReactNode;
  label: string;
  htmlFor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-lh items-center text-base sm:text-sm">
        {children}
      </div>
      <label className="text-base/7 sm:text-sm/6" htmlFor={htmlFor}>
        {label}
      </label>
    </div>
  );
}

export function ComponentsGallery() {
  const [reviewer, setReviewer] = useState(REVIEWERS[0]);

  return (
    <>
      <Section
        id="buttons"
        title="Buttons"
        description="Four heights — 24, 28, 32, 36 — and a deliberately lopsided variant set. A view gets exactly one filled button; everything else recedes to a raised neutral chip or a ghost, which is why the quiet variants outnumber the loud one many times over in real screens."
      >
        <Subsection
          title="Variants"
          hint="Shown together for reference. In a real view only one of these would be filled — and the accent never fills any of them, because a button already has its position, label and fill to say what it is."
        >
          <SpecimenRow>
            <Specimen label="default">
              <Button>Create branch</Button>
            </Specimen>
            <Specimen label="outline">
              <Button variant="outline">Compare</Button>
            </Specimen>
            <Specimen label="secondary">
              <Button variant="secondary">Stash</Button>
            </Specimen>
            <Specimen label="ghost">
              <Button variant="ghost">Cancel</Button>
            </Specimen>
            <Specimen label="ghost-muted">
              <Button variant="ghost-muted">Commit &amp; push</Button>
            </Specimen>
            <Specimen label="destructive">
              <Button variant="destructive">Discard</Button>
            </Specimen>
            <Specimen label="link">
              <Button variant="link">View on GitHub</Button>
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Sizes"
          hint="xs and icon-xs are for inline row actions, not for anything a form submits."
        >
          <SpecimenRow>
            <Specimen label="xs">
              <Button size="xs" variant="outline">
                Resolve
              </Button>
            </Specimen>
            <Specimen label="sm">
              <Button size="sm" variant="outline">
                Resolve
              </Button>
            </Specimen>
            <Specimen label="default">
              <Button variant="outline">Resolve</Button>
            </Specimen>
            <Specimen label="lg">
              <Button size="lg" variant="outline">
                Resolve
              </Button>
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Icons"
          hint="Mark the icon with data-icon so the button tightens the padding on that side instead of staying symmetric."
        >
          <SpecimenRow>
            <Specimen label='data-icon="inline-start"'>
              <Button variant="outline">
                <IconPlus data-icon="inline-start" />
                New thread
              </Button>
            </Specimen>
            <Specimen label='data-icon="inline-end"'>
              <Button variant="outline">
                Continue
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </Specimen>
            <Specimen label='size="icon"'>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Search">
                      <IconSearch />
                    </Button>
                  }
                />
                <TooltipContent>Search</TooltipContent>
              </Tooltip>
            </Specimen>
            <Specimen label='size="icon-sm"'>
              <Button variant="outline" size="icon-sm" aria-label="Delete">
                <IconTrash />
              </Button>
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="States"
          hint="Tab through the row to see focus. Nothing is drawn around the button — the accent blooms off its own shape and fades, and an invalid button blooms the same way in red, which outranks focus while it lasts."
        >
          <SpecimenRow>
            <Specimen label="disabled">
              <Button disabled>Push</Button>
            </Specimen>
            <Specimen label="busy">
              <Button variant="outline" disabled>
                <LoadingCursor label={null} />
                Fetching
              </Button>
            </Specimen>
            <Specimen label="aria-expanded">
              <Button variant="outline" aria-expanded>
                Branch menu
              </Button>
            </Specimen>
            <Specimen label="aria-invalid">
              <Button variant="outline" aria-invalid>
                Retry
              </Button>
            </Specimen>
          </SpecimenRow>
        </Subsection>
      </Section>

      <Section
        id="badges"
        title="Badges and status"
        description="Badges label, they do not shout. Soft brand tints read as information; the filled variant is reserved for a count that must not be missed."
      >
        <Subsection title="Variants">
          <SpecimenRow>
            <Specimen label="default">
              <Badge>3</Badge>
            </Specimen>
            <Specimen label="secondary">
              <Badge variant="secondary">Draft</Badge>
            </Specimen>
            <Specimen label="outline">
              <Badge variant="outline">master</Badge>
            </Specimen>
            <Specimen label="ghost">
              <Badge variant="ghost">Optional</Badge>
            </Specimen>
            <Specimen label="destructive">
              <Badge variant="destructive">Conflict</Badge>
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Tinted"
          hint="Brand and semantic tints, built from the ramp rather than the role tokens so text stays readable on the fill."
        >
          <SpecimenRow>
            <Specimen label="bg-brand-100 text-brand-800">
              <Badge className="bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                Review requested
              </Badge>
            </Specimen>
            <Specimen label="text-success">
              <Badge className="bg-success/10 text-success">
                <IconCheck data-icon="inline-start" />
                Checks passed
              </Badge>
            </Specimen>
            <Specimen label="text-warning-foreground">
              <Badge className="bg-warning/20 text-warning-foreground dark:bg-warning/25 dark:text-warning">
                Stale
              </Badge>
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Status dots"
          hint="For a state that repeats down a list, a dot plus a word beats a badge on every row."
        >
          <ul role="list" className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              { label: "Running", dot: "bg-brand-500" },
              { label: "Merged", dot: "bg-success" },
              { label: "Waiting", dot: "bg-warning" },
              { label: "Failed", dot: "bg-destructive" },
              { label: "Idle", dot: "bg-muted-foreground/40" },
            ].map(({ label, dot }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-base sm:text-sm"
              >
                <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                {label}
              </li>
            ))}
          </ul>
        </Subsection>

        <Subsection
          title="Agent orb"
          hint="Every wait an agent is responsible for wears this: the chat's thinking line, a running work-log step, a tab whose conversation is mid-turn. A plain data fetch keeps the caret."
        >
          <SpecimenRow>
            <Specimen label="14 — inline">
              <Orb size={14} label="Working" />
            </Specimen>
            <Specimen label="16 — beside a label">
              <ThinkingIndicator />
            </Specimen>
            <Specimen label="20 — default">
              <Orb label="Working" />
            </Specimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Agent orb — motion"
          hint="Blown up so the sweep can be judged frame by frame: the crest should cross the diagonal at one steady beat and wrap without a hitch, and every orb below should hold the same phase however long the page has been open."
        >
          <SpecimenRow className="items-end">
            <Specimen label="72 — the wave">
              <Orb size={72} label="Working" className="text-brand-500" />
            </Specimen>
            <Specimen label="40 — mid">
              <Orb size={40} label="Working" />
            </Specimen>
            <Specimen label="a list of running rows">
              <div className="flex flex-col gap-2">
                {[
                  "task/git-worktrees",
                  "task/landing-page",
                  "fix/diff-gutter",
                ].map((branch) => (
                  <div
                    key={branch}
                    className="flex items-center gap-2 rounded-md bg-elevate px-2 py-1.5 text-sm sm:text-xs"
                  >
                    <Orb size={14} />
                    <span className="font-mono text-muted-foreground">
                      {branch}
                    </span>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen label="mounted late">
              <LateOrb />
            </Specimen>
          </SpecimenRow>
        </Subsection>
      </Section>

      <Section
        id="forms"
        title="Form controls"
        description="Fields are filled rather than outlined, so a form reads as a soft stack instead of a grid of boxes. Focus is the only place a control gains a ring."
      >
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <Field
            label="Branch name"
            htmlFor="ks-branch"
            hint="Lowercase, slash-separated. This becomes the worktree folder name."
          >
            <Input
              id="ks-branch"
              name="branch"
              placeholder="task/inline-diff-comments"
            />
          </Field>

          <Field label="Search" htmlFor="ks-search">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ks-search"
                name="search"
                type="search"
                className="pl-8"
                placeholder="Find a file"
              />
            </div>
          </Field>

          <Field label="Repository" htmlFor="ks-repo" hint="Invalid state.">
            <Input
              id="ks-repo"
              name="repo"
              aria-invalid
              defaultValue="~/does/not/exist"
            />
          </Field>

          <Field label="Disabled" htmlFor="ks-disabled">
            <Input
              id="ks-disabled"
              name="disabled"
              disabled
              defaultValue="Read-only mirror"
            />
          </Field>

          <Field
            label="Commit message"
            htmlFor="ks-message"
            hint="Grows with its content up to the height of the panel."
          >
            <Textarea
              id="ks-message"
              name="message"
              placeholder="Describe the change"
            />
          </Field>

          <Field label="Reviewer" htmlFor="ks-reviewer">
            <Select
              value={reviewer}
              onValueChange={(v) => v !== null && setReviewer(v)}
            >
              <SelectTrigger id="ks-reviewer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEWERS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-x-10 gap-y-8 border-t border-foreground/10 pt-8 sm:grid-cols-3">
          <Subsection title="Checkbox">
            <div className="flex flex-col gap-3">
              <ChoiceRow label="Amend the last commit" htmlFor="ks-amend">
                <Checkbox id="ks-amend" name="amend" defaultChecked />
              </ChoiceRow>
              <ChoiceRow label="Sign the commit" htmlFor="ks-sign">
                <Checkbox id="ks-sign" name="sign" />
              </ChoiceRow>
              <ChoiceRow label="Unavailable here" htmlFor="ks-off">
                <Checkbox id="ks-off" name="off" disabled />
              </ChoiceRow>
            </div>
          </Subsection>

          <Subsection title="Radio">
            <div className="flex flex-col gap-3">
              {[
                { id: "ks-split", label: "Split diff", checked: true },
                { id: "ks-unified", label: "Unified diff", checked: false },
              ].map(({ id, label, checked }) => (
                <ChoiceRow key={id} label={label} htmlFor={id}>
                  <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
                    <input
                      type="radio"
                      id={id}
                      name="ks-diff-style"
                      defaultChecked={checked}
                      className={RADIO_CLASSES}
                    />
                    <span className="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-white group-not-has-checked:opacity-0 group-has-disabled:bg-muted-foreground" />
                  </span>
                </ChoiceRow>
              ))}
            </div>
          </Subsection>

          <Subsection title="Switch">
            <div className="flex flex-col gap-3">
              <ChoiceRow label="Show connectors" htmlFor="ks-connectors">
                <Switch
                  id="ks-connectors"
                  name="connectors"
                  defaultChecked
                  aria-label="Show connectors"
                />
              </ChoiceRow>
              <ChoiceRow label="Wrap long lines" htmlFor="ks-wrap">
                <Switch id="ks-wrap" name="wrap" aria-label="Wrap long lines" />
              </ChoiceRow>
              <ChoiceRow label="Locked by policy" htmlFor="ks-locked">
                <Switch
                  id="ks-locked"
                  name="locked"
                  disabled
                  aria-label="Locked by policy"
                />
              </ChoiceRow>
            </div>
          </Subsection>
        </div>
      </Section>

      <Section
        id="nav"
        title="Tabs"
        description="Active tabs change colour and gain a surface — never weight, which would nudge the row every time the selection moves."
      >
        <Subsection title="Filled" hint="For switching the body of a panel.">
          <Tabs defaultValue="changes">
            <TabsList>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="commits">Commits</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
            </TabsList>
            <TabsContent value="changes" className="pt-2 text-muted-foreground">
              14 files changed across 3 packages.
            </TabsContent>
            <TabsContent value="commits" className="pt-2 text-muted-foreground">
              6 commits since master.
            </TabsContent>
            <TabsContent
              value="comments"
              className="pt-2 text-muted-foreground"
            >
              2 unresolved threads.
            </TabsContent>
          </Tabs>
        </Subsection>

        <Subsection title="Line" hint="For page-level sections.">
          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </Tabs>
        </Subsection>
      </Section>

      <Section
        id="overlays"
        title="Overlays"
        description="Everything that floats shares one recipe: a light popover surface, a hairline ring, and a shadow that disappears in dark mode."
      >
        <SpecimenRow className="items-start">
          <Specimen label="Dialog">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                Discard changes
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Discard 14 changed files?</DialogTitle>
                  <DialogDescription>
                    This resets the working tree to master. Nothing is written
                    to the reflog, so the changes cannot be recovered.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="ghost" />}>
                    Keep them
                  </DialogClose>
                  <DialogClose render={<Button />}>Discard</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Specimen>

          <Specimen label="Dropdown menu">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <IconGitBranch data-icon="inline-start" />
                master
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Switch to</DropdownMenuLabel>
                  <DropdownMenuItem>task/inline-diff-comments</DropdownMenuItem>
                  <DropdownMenuItem>fix/safari-hover-shift</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <IconTrash />
                  Delete branch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Specimen>

          <Specimen label="Popover">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>
                Details
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>Merge base</PopoverTitle>
                  <PopoverDescription>
                    Branched from master six commits ago, at 97c3132.
                  </PopoverDescription>
                </PopoverHeader>
                <Button size="sm" variant="outline">
                  Compare
                </Button>
              </PopoverContent>
            </Popover>
          </Specimen>

          <Specimen label="Tooltip">
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>
                Hover me
              </TooltipTrigger>
              <TooltipContent>Fetch and prune remote branches</TooltipContent>
            </Tooltip>
          </Specimen>

          <Specimen label="Tooltip + shortcut">
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>
                Inbox
              </TooltipTrigger>
              <TooltipContent>
                Go to inbox
                <KbdGroup>
                  <Kbd>G</Kbd>
                  then
                  <Kbd>I</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
          </Specimen>
        </SpecimenRow>

        <Subsection
          title="Symbol cards"
          hint="What a token in the code opens: its documentation on hover, its usages on a click, or a choice of declarations when there is more than one. Three answers to one gesture, so one heading — the symbol in the code font, and a chip for what it is. A hover runs flush from there; a list puts a rule under the heading, because it scrolls beneath it."
        >
          <SpecimenRow className="items-start">
            <SymbolCardSpecimen label="Hover documentation">
              <HoverDocumentation symbol="commit" contents={SYMBOL_HOVER} />
            </SymbolCardSpecimen>

            <SymbolCardSpecimen label="Hover documentation, with a link out">
              <HoverDocumentation symbol="gap" contents={SYMBOL_HOVER_CSS} />
            </SymbolCardSpecimen>

            <SymbolCardSpecimen label="Usages">
              <UsagesList
                symbol="commit"
                references={SYMBOL_USAGES}
                onOpen={() => undefined}
              />
            </SymbolCardSpecimen>

            <SymbolCardSpecimen label="Declarations">
              <TargetChoice targets={SYMBOL_TARGETS} onOpen={() => undefined} />
            </SymbolCardSpecimen>
          </SpecimenRow>
        </Subsection>

        <Subsection
          title="Toasts"
          hint="Fire one of each. The long ones are the interesting cases: a toast never grows past its own width, and an unbroken sha or path breaks rather than pushing the card open."
        >
          <div className="flex flex-wrap gap-2">
            {TOAST_MOCKS.map((mock) => (
              <Button
                key={mock.label}
                size="sm"
                variant="outline"
                onClick={mock.fire}
              >
                {mock.label}
              </Button>
            ))}
          </div>
        </Subsection>
      </Section>
    </>
  );
}
