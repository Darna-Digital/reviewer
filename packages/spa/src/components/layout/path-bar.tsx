/**
 * The centre pane's last line: where you are, and what acts on it.
 *
 * The trail runs from the mode you are in through every folder of the open
 * file, and each of those folders is a dropdown of what else sits beside it —
 * folders open a submenu, files open in the pane above. The file's own controls
 * (edit it, read its history, save it) end the line on the right.
 */
import { IconFolder, IconHistory, IconPencil } from "@tabler/icons-react";
import { type ReactNode, useMemo } from "react";
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { folderEntries, pathSegments } from "@/lib/folder-entries";
import { cn } from "@/lib/utils";

export interface PathBarProps {
  /** The mode trail the file's folders continue. */
  readonly crumbs: ReadonlyArray<Crumb>;
  /** The open file, or null when the pane shows something else. */
  readonly path: string | null;
  /** Every path in the repository — what the folder dropdowns read. */
  readonly paths: ReadonlyArray<string>;
  readonly onOpenFile: (path: string) => void;
  /** Omit to leave the open file read-only, e.g. an image or one already open
   * for editing. */
  readonly onEdit?: () => void;
  readonly onShowHistory?: () => void;
  /** The open view's own controls, e.g. Save and its problem count. */
  readonly actions?: ReactNode;
}

export function PathBar({
  crumbs,
  path,
  paths,
  onOpenFile,
  onEdit,
  onShowHistory,
  actions,
}: PathBarProps) {
  const folderCrumbs = useMemo<ReadonlyArray<Crumb>>(
    () =>
      path === null
        ? []
        : pathSegments(path).map((segment, index, segments) => ({
            id: `path:${segment.path}`,
            label: segment.name,
            // Only the file at the end of the trail wears a mark: the folders
            // above it are the path, and a row of identical folder glyphs is
            // noise rather than information.
            ...(index === segments.length - 1
              ? {
                  icon: (props: { className?: string }) => (
                    <FileTypeIcon path={segment.path} {...props} />
                  ),
                }
              : {}),
            menu: () => (
              <FolderItems
                paths={paths}
                dir={segment.parent}
                openPath={path}
                onOpenFile={onOpenFile}
              />
            ),
          })),
    [path, paths, onOpenFile]
  );

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-t px-2">
      <Breadcrumbs crumbs={[...crumbs, ...folderCrumbs]} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onShowHistory !== undefined && (
          <Button variant="ghost" size="xs" onClick={onShowHistory}>
            <IconHistory /> History
          </Button>
        )}
        {actions}
        {onEdit !== undefined && (
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <IconPencil /> Edit
          </Button>
        )}
      </div>
    </div>
  );
}

interface FolderItemsProps {
  readonly paths: ReadonlyArray<string>;
  readonly dir: string;
  /** The file the pane is on, so its own trail reads as the current one. */
  readonly openPath: string;
  readonly onOpenFile: (path: string) => void;
}

function FolderItems({ paths, dir, openPath, onOpenFile }: FolderItemsProps) {
  const entries = useMemo(() => folderEntries(paths, dir), [paths, dir]);
  const onTrail = (entryPath: string) =>
    openPath === entryPath || openPath.startsWith(`${entryPath}/`);
  return (
    <>
      {entries.map((entry) =>
        entry.isDirectory ? (
          <FolderSubmenu
            key={entry.path}
            name={entry.name}
            paths={paths}
            dir={entry.path}
            openPath={openPath}
            onOpenFile={onOpenFile}
            current={onTrail(entry.path)}
          />
        ) : (
          <DropdownMenuItem
            key={entry.path}
            onClick={() => onOpenFile(entry.path)}
            className={cn(onTrail(entry.path) && "font-medium text-foreground")}
          >
            <FileTypeIcon path={entry.path} /> {entry.name}
          </DropdownMenuItem>
        )
      )}
    </>
  );
}

function FolderSubmenu({
  name,
  current,
  ...items
}: FolderItemsProps & { readonly name: string; readonly current: boolean }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className={cn(current && "font-medium text-foreground")}
      >
        <IconFolder /> {name}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(60vh,24rem)] overflow-y-auto">
        <FolderItems {...items} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
