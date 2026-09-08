/**
 * What the centre pane shows when a file could not be read.
 *
 * It used to be a line of red text and nothing else, which left the pane dead
 * for as long as the failed read stayed fresh — a file that had just been
 * created and whose read lost a race with the refresh behind it stayed
 * unopenable until you clicked away and back. It says what went wrong and
 * offers to ask again, which is what anyone would want to do next.
 */
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
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

export function OpenFailed({
  path,
  error,
  onRetry,
  retrying = false,
}: OpenFailedProps) {
  const reason = errorReason(error, "The file could not be read.");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <IconAlertTriangle
        className="size-10 text-muted-foreground/30"
        stroke={1.25}
      />
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">
          Could not open {fileNameOf(path)}
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{reason}</p>
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
