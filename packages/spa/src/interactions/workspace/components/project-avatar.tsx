/**
 * The square initials badge a project or one of its repositories is known by.
 * Shared by the project chip and the repository chip so a root reads the same
 * on the chip as it does in the list the chip opens.
 */
import { repoAvatar } from "@/lib/repo-avatar";
import { cn } from "@/lib/utils";

export function ProjectAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const avatar = repoAvatar(name);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold text-white",
        className ?? "size-5"
      )}
      style={{ backgroundColor: avatar.color }}
    >
      {avatar.initials}
    </span>
  );
}
