import { PaneHeader } from "#/components/app-window";
import { CodeLines, codeLines } from "#/components/code";
import { GitPullRequest, Message } from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";

const TARGETS = [
  { label: "Local changes", count: 4 },
  { label: "Commit 79b229c", count: 1 },
  { label: "master…task/landing-page", count: 12 },
  { label: "PR #27", count: 3, active: true },
];

const HEAD = `export const createCommentsFunctions = (
  deps: CommentsDependencies
): CommentsFunctions => ({`;

const BODY = `  async submit(ctx, location, body) {
    const text = body.trim();
    if (text.length === 0) return null;

    if (ctx.mode === "review" && ctx.selectedPull) {
      return deps.sideEffects.addPullComment(
        ctx.selectedPull.number,
        { ...location, body: text }
      );
    }`;

export function ReviewShowcase() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5">
      <div className="flex flex-wrap gap-1.5 border-b border-black/8 bg-neutral-50/70 px-3 py-2">
        {TARGETS.map((target) => (
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
              target.active
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 ring-1 ring-black/8 ring-inset"
            }`}
            key={target.label}
          >
            {target.label}
            <span
              className={
                target.active
                  ? "font-mono text-[10px] text-white/60"
                  : "font-mono text-[10px] text-neutral-400"
              }
            >
              {target.count}
            </span>
          </span>
        ))}
      </div>

      <PaneHeader
        actions={
          <span className="flex items-center gap-1.5">
            <GitPullRequest className="size-3.5" />
            Bring the comment store behind the feature
          </span>
        }
      >
        <Message className="size-3.5 text-neutral-400" />
        <span className="truncate font-medium text-neutral-800">
          interactions/comments/functions/comments.functions.ts
        </span>
      </PaneHeader>

      <CodeLines lines={codeLines(HEAD, 18)} />

      <div className="border-y border-black/8 bg-[#fbfaff]">
        <div className="mx-3 my-3 max-w-100 rounded-md border border-black/8 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Avatar initials="RR" />
            <span className="text-xs font-medium text-neutral-800">
              Rūtenis Raila
            </span>
            <span className="text-[11px] text-neutral-400">on line 21</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-700">
            A blank body should be a no-op here, not at the call site — every
            surface that composes a comment gets the rule for free.
          </p>

          <div className="mt-3 ml-10 border-l border-black/8 pl-3">
            <div className="flex items-center gap-2">
              <Avatar initials="CC" />
              <span className="text-xs font-medium text-neutral-800">
                Claude Code
              </span>
              <span className="text-[11px] text-neutral-400">just now</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-700">
              Moved the guard into <code>submit</code> and covered it in
              <code> comments.functions.test.ts</code>.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3 text-[11px] text-neutral-400">
            <span>Add reply…</span>
            <span className="text-neutral-500">Resolve</span>
          </div>
        </div>
      </div>

      <CodeLines lines={codeLines(BODY, 21)} />
    </div>
  );
}
