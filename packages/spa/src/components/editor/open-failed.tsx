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
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { errorReason } from "@/lib/errors";

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

const breakableAtSlashes = (path: string) =>
  path.split("/").map((segment, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <>
          /<wbr />
        </>
      )}
      {segment}
    </Fragment>
  ));

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
        <span className="mt-1 inline-flex max-w-full items-start gap-1.5 text-left text-muted-foreground/60">
          <FileTypeIcon path={path} className="mt-px size-3.5 shrink-0" />
          <code className="font-mono text-xs wrap-anywhere">
            {breakableAtSlashes(path)}
          </code>
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
