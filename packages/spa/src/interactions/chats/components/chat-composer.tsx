/**
 * The chat composer — prompt textarea over a selector row: model picker,
 * effort, mode, access level ("Full access"), and send/stop.
 * Owns only the draft text; settings and mode live with the caller (local state
 * on the new-thread page, the chat itself once it exists).
 *
 * The row is not fixed: effort and access are what the chosen agent can be
 * asked for while running the chosen model (`chatCapabilities`), so cursor —
 * which has no reasoning flag — shows no effort menu at all, opencode offers
 * the variants its model named, and an agent that cannot tell "auto-accept
 * edits" from "full access" stops claiming to. Picking a model moves the
 * settings onto what that model does offer, in the same patch.
 *
 * Images can be picked or pasted here, but they are not dropped here: the drop
 * target is the whole session pane, so a file can be let go anywhere in the
 * conversation (see `ImageDropZone`) and still arrive as a chip on this box.
 *
 * The prompt box rests at a few lines and is dragged taller by its top edge —
 * the height is the app's, not this thread's, so a box pulled open for one long
 * prompt is still open at the next.
 */
import {
  IconSend,
  IconCheck,
  IconChevronDown,
  IconHammer,
  IconPhotoPlus,
  IconPlayerStopFilled,
  IconSitemap,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Separator } from "@/components/ui/separator";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import {
  catalogCapabilities,
  withinCapabilities,
  type ChatModelCatalog,
  type ChatProviderKind,
} from "@reviewer/core/chats";
import { useDraft } from "@/lib/composer-drafts";
import {
  clearComposerAttachments,
  removeComposerAttachment,
  useComposerAttachments,
} from "@/interactions/chats/adapters/composer-attachments.store";
import { cn } from "@/lib/utils";
import type { ChatSettings } from "@/interactions/chats/interfaces/chats.interfaces";
import type { ChatMode } from "@/interactions/chats/functions/chat-mode.functions";
import { useListEditing } from "@/hooks/use-list-editing";
import {
  accessOptions,
  effortOptions,
  type SelectorOption,
} from "@/interactions/chats/functions/chat-capability.functions";
import { AttachmentChip, AttachmentGrid } from "./image-attachments";
import {
  attachmentSource,
  isImageFile,
  toImagePayload,
  type ChatImagePayload,
} from "./attachments";
import { attachImageFiles } from "./image-drop-zone";
import { ModelPicker } from "./model-picker";

const MODES: ReadonlyArray<SelectorOption<ChatMode>> = [
  {
    value: "build",
    label: "Build",
    hint: "Read, change and run the code",
    icon: IconHammer,
  },
  {
    value: "analysis",
    label: "Analysis",
    hint: "Draw the flow in the pane",
    icon: IconSitemap,
  },
];

/**
 * One selector — effort, mode, access — as a picker rather than a word list:
 * each option wears its own icon, its label, and the line saying what choosing
 * it does, because these are settings whose consequences are not guessable from
 * a single word ("Supervised" of what?). The trigger borrows the chosen
 * option's icon, so the row reads as a set of states rather than of buttons.
 */
function SelectorMenu<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: ReadonlyArray<SelectorOption<T>>;
  value: T;
  onSelect: (value: T) => void;
  ariaLabel: string;
}) {
  const current = options.find((o) => o.value === value);
  const CurrentIcon = current?.icon;
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
        {CurrentIcon && (
          <CurrentIcon className="size-3.5 text-muted-foreground" />
        )}
        {current?.label ?? value}
        <IconChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        {options.map((option) => {
          const OptionIcon = option.icon;
          const chosen = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={cn(
                "items-start gap-2.5 py-2 whitespace-normal",
                chosen && "bg-muted/60"
              )}
            >
              <OptionIcon
                className={cn(
                  "mt-0.5 size-4 text-muted-foreground",
                  chosen && "text-foreground"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {option.label}
                  {chosen && <IconCheck className="size-3.5 text-primary" />}
                </span>
                {option.hint.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatComposer({
  settings,
  onSettingsChange,
  mode,
  onModeChange,
  catalog,
  onSend,
  running,
  onStop,
  placeholder,
  draftKey,
  textareaRef: externalTextareaRef,
}: {
  settings: ChatSettings;
  onSettingsChange: (patch: Partial<ChatSettings>) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  catalog: ChatModelCatalog | undefined;
  /** Resolves once the send is accepted; the draft clears only on success. */
  onSend: (
    text: string,
    images: ReadonlyArray<ChatImagePayload>
  ) => Promise<void>;
  running: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** Stable id the draft is persisted under so it survives navigation. */
  draftKey: string;
  /** Lets a caller that writes the draft put the caret where it landed. */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // The prompt lives in the shared draft store (keyed per chat) rather than
  // local state, so leaving and returning to a thread keeps what you typed.
  const [text, setText] = useDraft(draftKey);
  const prefs = useUiPrefs();
  // Not React state — see `usePanelSize`.
  const prompt = usePanelSize("composer-h", prefs.composerHeight, "height");
  const [sending, setSending] = useState(false);
  // Pending images are kept beside the draft text, under the same key, so
  // navigating away and back finds the composer exactly as it was left.
  const attachments = useComposerAttachments(draftKey);
  const ownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalTextareaRef ?? ownTextareaRef;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editList = useListEditing({ textareaRef, text, setText });
  const capabilities = catalogCapabilities(
    catalog,
    settings.provider,
    settings.model
  );
  const efforts = effortOptions(capabilities.efforts);

  // One patch, not two: the model and the settings it drags with it are stored
  // together, so a chat is never briefly on a model at an effort it doesn't
  // take.
  const chooseModel = (model: string, provider: ChatProviderKind) =>
    onSettingsChange(
      withinCapabilities(
        { ...settings, model, provider },
        catalogCapabilities(catalog, provider, model)
      )
    );

  // A send while a turn is running is accepted, not blocked: the server appends
  // the message to the thread and the agent picks it up when the turn settles.
  const canSend =
    !sending && (text.trim().length > 0 || attachments.length > 0);

  const removeAttachment = (id: string) =>
    removeComposerAttachment(draftKey, id);

  // Deliver the draft. Clears it on success; keeps it on failure so the user
  // can retry — the caller has already surfaced a toast.
  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(text, attachments.map(toImagePayload));
      setText("");
      clearComposerAttachments(draftKey);
    } catch {
      // keep the draft for a manual retry
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col">
      <ResizeHandle
        orientation="row"
        value={prompt.current}
        min={56}
        max={() => Math.max(56, window.innerHeight * 0.6)}
        direction={-1}
        onResize={prompt.onResize}
        onResizeEnd={(height) => setUiPrefs({ composerHeight: height })}
        label="Resize the message box"
      />
      <div className="relative rounded-lg border bg-background shadow-sm focus-within:border-ring/60">
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
            void attachImageFiles(draftKey, Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <textarea
          ref={textareaRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some(isImageFile)) {
              e.preventDefault();
              void attachImageFiles(draftKey, files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
              return;
            }
            editList(e);
          }}
          style={prompt.style}
          placeholder={placeholder ?? "Ask anything about this repository…"}
          className="w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <ModelPicker
            catalog={catalog}
            model={settings.model}
            onSelect={chooseModel}
          />
          <Separator
            orientation="vertical"
            className="mx-0.5 h-4 self-center data-vertical:self-center"
          />
          {/* An agent that picks its own reasoning depth (cursor), or a model
              that named no levels, gets no menu rather than a dead one. */}
          {efforts.length > 0 && (
            <>
              <SelectorMenu
                options={efforts}
                value={settings.effort}
                onSelect={(effort) => onSettingsChange({ effort })}
                ariaLabel="Reasoning effort"
              />
              <Separator
                orientation="vertical"
                className="mx-0.5 h-4 self-center data-vertical:self-center"
              />
            </>
          )}
          <SelectorMenu
            options={MODES}
            value={mode}
            onSelect={onModeChange}
            ariaLabel="Session mode"
          />
          <Separator
            orientation="vertical"
            className="mx-0.5 h-4 self-center data-vertical:self-center"
          />
          <SelectorMenu
            options={accessOptions(capabilities.access)}
            value={settings.access}
            onSelect={(access) => onSettingsChange({ access })}
            ariaLabel="Access level"
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
            <IconSend className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
