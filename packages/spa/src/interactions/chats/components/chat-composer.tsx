/**
 * The chat composer — prompt textarea over a selector row: model picker,
 * effort, access level ("Full access"), Build/Plan mode, and send/stop.
 * Owns only the draft text; settings live with the caller (local state on the
 * new-thread page, the chat itself once it exists).
 */
import {
  IconArrowUp,
  IconChevronDown,
  IconHammer,
  IconLock,
  IconLockOpen,
  IconMap,
  IconPhotoPlus,
  IconPlayerStopFilled,
} from "@tabler/icons-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import type {
  ChatAccess,
  ChatEffort,
  ChatMode,
  ChatModelCatalog,
} from "@byconvo/core/chats"
import { useDraft } from "@/lib/chat-drafts"
import { cn } from "@/lib/utils"
import type { ChatSettings } from "@/interactions/chats/interfaces/chats.interfaces"
import { AttachmentChip, AttachmentGrid } from "./image-attachments"
import {
  attachmentSource,
  isImageFile,
  MAX_IMAGE_BYTES,
  readImageAttachment,
  toImagePayload,
  type ChatImagePayload,
  type ComposerAttachment,
} from "./attachments"
import { ModelPicker } from "./model-picker"

const EFFORTS: Array<{ value: ChatEffort; label: string; hint: string }> = [
  { value: "low", label: "Low", hint: "Fast, minimal reasoning" },
  { value: "medium", label: "Medium", hint: "Balanced reasoning" },
  { value: "high", label: "High", hint: "Deep reasoning" },
]

const ACCESS: Array<{ value: ChatAccess; label: string; hint: string }> = [
  {
    value: "supervised",
    label: "Supervised",
    hint: "Refuse gated commands and edits",
  },
  {
    value: "acceptEdits",
    label: "Auto-accept edits",
    hint: "Edit files freely, gate commands",
  },
  {
    value: "fullAccess",
    label: "Full access",
    hint: "Commands and edits without prompts",
  },
]

const MODES: Array<{ value: ChatMode; label: string; hint: string }> = [
  { value: "build", label: "Build", hint: "Make changes" },
  { value: "plan", label: "Plan", hint: "Read-only planning" },
]

function SelectorMenu<T extends string>({
  options,
  value,
  onSelect,
  icon,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; hint: string }>
  value: T
  onSelect: (value: T) => void
  icon?: React.ReactNode
  ariaLabel: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs font-medium"
            aria-label={ariaLabel}
          />
        }
      >
        {icon}
        {current?.label ?? value}
        <IconChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-52">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={cn("gap-3", option.value === value && "bg-muted/60")}
          >
            <span className="font-medium">{option.label}</span>
            <span className="ml-auto pl-4 text-xs text-muted-foreground">
              {option.hint}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ChatComposer({
  settings,
  onSettingsChange,
  catalog,
  onSend,
  running,
  onStop,
  placeholder,
  draftKey,
}: {
  settings: ChatSettings
  onSettingsChange: (patch: Partial<ChatSettings>) => void
  catalog: ChatModelCatalog | undefined
  /** Resolves once the send is accepted; the draft clears only on success. */
  onSend: (
    text: string,
    images: ReadonlyArray<ChatImagePayload>
  ) => Promise<void>
  running: boolean
  onStop?: () => void
  placeholder?: string
  /** Stable id the draft is persisted under so it survives navigation. */
  draftKey: string
}) {
  // The prompt lives in the shared draft store (keyed per chat) rather than
  // local state, so leaving and returning to a thread keeps what you typed.
  const [text, setText] = useDraft(draftKey)
  const [sending, setSending] = useState(false)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // dragenter/dragleave fire per descendant, so count depth to know when the
  // pointer has truly left the composer (matches lib/terminal/image-drop.ts).
  const dragDepth = useRef(0)

  // A send while a turn is running is accepted, not blocked: the server appends
  // the message to the thread and the agent picks it up when the turn settles.
  const canSend = !sending && (text.trim().length > 0 || attachments.length > 0)

  const addFiles = async (files: ReadonlyArray<File>) => {
    const images = files.filter(isImageFile)
    if (images.length === 0) {
      if (files.length > 0) toast.error("Only image files can be attached")
      return
    }
    for (const file of images) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name || "image"} is too large (max 15 MB)`)
        continue
      }
      try {
        const attachment = await readImageAttachment(file)
        setAttachments((prev) => [...prev, attachment])
      } catch {
        toast.error(`Could not read ${file.name || "image"}`)
      }
    }
  }

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  // Deliver the draft. Clears it on success; keeps it on failure so the user
  // can retry — the caller has already surfaced a toast.
  const submit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      await onSend(text, attachments.map(toImagePayload))
      setText("")
      setAttachments([])
    } catch {
      // keep the draft for a manual retry
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-background shadow-sm focus-within:border-ring/60",
        dragging && "border-primary"
      )}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        void addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      {attachments.length > 0 && (
        <AttachmentGrid className="px-3 pt-3">
          {attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={{
                ...attachment,
                source: attachmentSource(attachment),
              }}
              onRemove={() => removeAttachment(attachment.id)}
            />
          ))}
        </AttachmentGrid>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
      <textarea
        ref={textareaRef}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files)
          if (files.some(isImageFile)) {
            e.preventDefault()
            void addFiles(files)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            void submit()
          }
        }}
        rows={3}
        placeholder={placeholder ?? "Ask anything about this repository…"}
        className="max-h-60 min-h-20 w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      {dragging && (
        <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-foreground">
          Drop images to attach them
        </div>
      )}
      <div className="flex items-center gap-1 px-2 pb-2">
        <ModelPicker
          catalog={catalog}
          model={settings.model}
          onSelect={(model, provider) => onSettingsChange({ model, provider })}
        />
        <Separator
          orientation="vertical"
          className="mx-0.5 h-4 self-center data-vertical:self-center"
        />
        <SelectorMenu
          options={EFFORTS}
          value={settings.effort}
          onSelect={(effort) => onSettingsChange({ effort })}
          ariaLabel="Reasoning effort"
        />
        <Separator
          orientation="vertical"
          className="mx-0.5 h-4 self-center data-vertical:self-center"
        />
        <SelectorMenu
          options={ACCESS}
          value={settings.access}
          onSelect={(access) => onSettingsChange({ access })}
          icon={
            settings.access === "fullAccess" ? (
              <IconLockOpen className="size-3.5 text-muted-foreground" />
            ) : (
              <IconLock className="size-3.5 text-muted-foreground" />
            )
          }
          ariaLabel="Access level"
        />
        <Separator
          orientation="vertical"
          className="mx-0.5 h-4 self-center data-vertical:self-center"
        />
        <SelectorMenu
          options={MODES}
          value={settings.mode}
          onSelect={(mode) => onSettingsChange({ mode })}
          icon={
            settings.mode === "plan" ? (
              <IconMap className="size-3.5 text-muted-foreground" />
            ) : (
              <IconHammer className="size-3.5 text-muted-foreground" />
            )
          }
          ariaLabel="Agent mode"
        />
        <Separator
          orientation="vertical"
          className="mx-0.5 h-4 self-center data-vertical:self-center"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Attach images"
          onClick={() => fileInputRef.current?.click()}
        >
          <IconPhotoPlus className="size-4 text-muted-foreground" />
        </Button>
        <div className="flex-1" />
        {running && onStop !== undefined && (
          <Button
            size="icon"
            className="size-7 rounded-full"
            variant="secondary"
            aria-label="Stop generation"
            onClick={onStop}
          >
            <IconPlayerStopFilled className="size-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          className="size-7 rounded-full"
          aria-label="Send message"
          disabled={!canSend}
          onClick={() => void submit()}
        >
          <IconArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  )
}
