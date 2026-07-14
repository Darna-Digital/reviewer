/**
 * Image attachments shown as a thumbnail grid — the composer's pending picks
 * (a removable chip) and a sent message's previews (click to view larger).
 * Follows the ai-sdk "Attachments" grid pattern, built on this app's UI kit.
 */
import { IconX } from "@tabler/icons-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** The minimum an attachment needs to render a preview. */
interface AttachmentImage {
  readonly name: string
  readonly thumbnail: string
}

/** Wrapping row of attachment thumbnails. */
export function AttachmentGrid({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
}

/** A pending composer attachment: a small thumbnail with a hover remove button. */
export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: AttachmentImage
  onRemove: () => void
}) {
  return (
    <div className="group relative size-16 overflow-hidden rounded-xl border bg-muted">
      <img
        src={attachment.thumbnail}
        alt={attachment.name}
        title={attachment.name}
        className="size-full object-cover"
      />
      <button
        type="button"
        aria-label={`Remove ${attachment.name}`}
        onClick={onRemove}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 shadow-sm backdrop-blur-sm transition group-hover:opacity-100 hover:bg-background focus-visible:opacity-100"
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  )
}

/** A sent message's image preview — click to open a larger view in a dialog. */
export function AttachmentPreview({
  attachment,
}: {
  attachment: AttachmentImage
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${attachment.name}`}
        className="group relative size-32 overflow-hidden rounded-xl border bg-muted transition outline-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <img
          src={attachment.thumbnail}
          alt={attachment.name}
          className="size-full object-cover"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[92vw] gap-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-3xl dark:ring-0">
          <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
          <img
            src={attachment.thumbnail}
            alt={attachment.name}
            className="max-h-[85vh] w-full rounded-2xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
