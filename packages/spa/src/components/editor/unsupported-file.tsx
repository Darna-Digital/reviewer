/**
 * What the centre pane shows for a file it cannot render — a binary blob, or an
 * image in a format the browser has no decoder for. It says so plainly and
 * leaves it there.
 */
import { IconFileUnknown } from "@tabler/icons-react";

const SIZE_UNITS = ["B", "KB", "MB", "GB"];

const formatSize = (bytes: number) => {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? `${size}` : size.toFixed(size < 10 ? 1 : 0);
  return `${rounded} ${SIZE_UNITS[unit]}`;
};

const fileNameOf = (path: string) => path.split("/").at(-1) ?? path;

const kindOf = (path: string) => {
  const name = fileNameOf(path);
  const extension = name.includes(".") ? name.split(".").at(-1) : undefined;
  return extension === undefined
    ? "This file"
    : `.${extension.toLowerCase()} files`;
};

interface UnsupportedFileProps {
  path: string;
  /** Byte size, when the server has already told us — omit to leave it out. */
  sizeBytes?: number;
}

export function UnsupportedFile({ path, sizeBytes }: UnsupportedFileProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <IconFileUnknown
        className="size-10 text-muted-foreground/30"
        stroke={1.25}
      />
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">
          Can&rsquo;t open {fileNameOf(path)}
        </div>
        <p className="max-w-xs text-sm text-muted-foreground">
          {kindOf(path)} can&rsquo;t be shown here
        </p>
      </div>
      {sizeBytes !== undefined && (
        <span className="text-xs text-muted-foreground/60">
          {formatSize(sizeBytes)}
        </span>
      )}
    </div>
  );
}
