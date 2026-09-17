/**
 * The drop target for composer images. An image is dragged in to say "look at
 * this" about the conversation, not about the text box, so the target is the
 * whole session pane — transcript, empty state and composer alike — rather than
 * the few lines of the prompt box the file would otherwise have to be aimed at.
 *
 * Dropped images land in the same pending-attachment store the picker and paste
 * write to (`composer-attachments.store`), keyed by the composer's draft key,
 * so a drop anywhere in the pane shows up as a chip on the composer below.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addComposerAttachment } from "@/interactions/chats/adapters/composer-attachments.store";
import {
  isImageFile,
  MAX_IMAGE_BYTES,
  readImageAttachment,
} from "./attachments";

/** Read `files` into `draftKey`'s pending attachments, skipping non-images. */
export const attachImageFiles = async (
  draftKey: string,
  files: ReadonlyArray<File>
) => {
  const images = files.filter(isImageFile);
  if (images.length === 0) {
    if (files.length > 0) toast.error("Only image files can be attached");
    return;
  }
  for (const file of images) {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${file.name || "image"} is too large (max 15 MB)`);
      continue;
    }
    try {
      addComposerAttachment(draftKey, await readImageAttachment(file));
    } catch {
      toast.error(`Could not read ${file.name || "image"}`);
    }
  }
};

const draggingFiles = (event: React.DragEvent): boolean =>
  event.dataTransfer.types.includes("Files");

export function ImageDropZone({
  draftKey,
  className,
  children,
}: {
  /** Which composer the dropped images are attached to. */
  draftKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire per descendant, so count depth to know when the
  // pointer has truly left the pane (matches lib/terminal/image-drop.ts).
  const dragDepth = useRef(0);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (!draggingFiles(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!draggingFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!draggingFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!draggingFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void attachImageFiles(draftKey, Array.from(e.dataTransfer.files));
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-foreground">
          Drop images to attach them
        </div>
      )}
    </div>
  );
}
