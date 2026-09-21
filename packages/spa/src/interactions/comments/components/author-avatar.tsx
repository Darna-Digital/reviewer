/**
 * Round comment-author avatar. GitHub authors resolve to their real avatar via
 * `github.com/<user>.png`; everyone else (and any image that fails to load)
 * gets the monogram macOS draws for a contact with no picture — two letters of
 * the name on a soft grey gradient — so a note by whoever is at the keyboard
 * looks the way their own card does in Contacts.
 */
import { useEffect, useState } from "react";
import { repoAvatar } from "@/lib/repo-avatar";
import { cn } from "@/lib/utils";
import type { ReviewComment } from "@reviewer/core/comments";

export function AuthorAvatar({
  author,
  source,
  className,
}: {
  author: string;
  source: ReviewComment["source"];
  className?: string;
}) {
  const { initials } = repoAvatar(author);
  const githubUrl =
    source === "github" && /^[\w-]+$/.test(author)
      ? `https://github.com/${author}.png?size=48`
      : null;
  const [failed, setFailed] = useState(false);

  // Reset the error state if the author/url changes (avatars are reused across
  // re-renders as comments stream in).
  useEffect(() => setFailed(false), [githubUrl]);

  const base = cn(
    "size-7 shrink-0 overflow-hidden rounded-full select-none",
    className
  );

  if (githubUrl !== null && !failed) {
    return (
      <img
        src={githubUrl}
        alt={author}
        className={cn(base, "object-cover")}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={author}
      className={cn(
        base,
        "monogram flex items-center justify-center text-[11px] font-medium tracking-tight text-white"
      )}
    >
      {initials}
    </span>
  );
}
