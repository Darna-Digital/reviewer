/**
 * What the centre pane shows when a file could not be read.
 *
 * It used to be a line of red text and nothing else, which left the pane dead
 * for as long as the failed read stayed fresh — a file that had just been
 * created and whose read lost a race with the refresh behind it stayed
 * unopenable until you clicked away and back. It says what went wrong and
 * offers to ask again, which is what anyone would want to do next.
 */
import { IconFileAlert } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { errorReason } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface OpenFailedProps {
  path: string;
  /** Whatever the read failed with — shown when it says anything useful. */
  error?: unknown;
  /** Read the file again. Omit where there is nothing to retry with. */
  onRetry?: () => void;
  /** Whether a retry is in flight, so the button says so. */
  retrying?: boolean;
}

const fileNameOf = (path: string) => path.split("/").at(-1) ?? path;

/* The path stays on one line and scrolls sideways rather than wrapping: a deep
   path broke into a ragged block that pulled the eye away from the sentence
   above it, and a path is read segment by segment anyway. No scrollbar — it
   would draw a second line under a line of text — so the edges fade to say
   there is more, and only the edge that still has path behind it. */
const PATH_LINE = cn(
  "min-w-0 overflow-x-auto font-mono text-xs whitespace-nowrap",
  "scrollbar-none",
  "scroll-fade-when-scrollable scroll-fade-x [--scroll-fade-size:1rem]"
);

export function OpenFailed({
  path,
  error,
  onRetry,
  retrying = false,
}: OpenFailedProps) {
  const reason = errorReason(error, "The file could not be read.");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <IconFileAlert className="size-6" stroke={1.5} />
      </div>
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <h2 className="font-heading text-base leading-snug font-medium tracking-tight text-balance">
          Could not open {fileNameOf(path)}
        </h2>
        <p className="max-w-[44ch] text-sm/6 text-pretty text-muted-foreground">
          {reason}
        </p>
        <span className="mt-1 flex max-w-full items-center gap-1.5 text-left text-muted-foreground/60">
          <FileTypeIcon path={path} className="size-3.5 shrink-0" />
          <code className={PATH_LINE}>{path}</code>
        </span>
      </div>
      {onRetry !== undefined && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      )}
    </div>
  );
}
