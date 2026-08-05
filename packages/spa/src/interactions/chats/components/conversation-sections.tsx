/**
 * A rail of ticks in the gutter beside the thread — one per question the reader
 * asked. A long conversation scrolls past as an undifferentiated column, so the
 * ticks give it chapters: the one you are reading is lit, hovering any of them
 * previews the question without leaving your place, and clicking jumps there.
 *
 * It sits against the pane's left edge, clear of the text rather than tracking
 * it, and hides itself when the pane is too narrow to spare the margin.
 */
import { IconPhoto } from "@tabler/icons-react";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";
import type { ConversationSection } from "../functions/conversation-sections.functions";

export function ConversationSections({
  sections,
  activeId,
  onSelect,
}: {
  sections: ReadonlyArray<ConversationSection>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Questions in this conversation"
      className="absolute top-1/2 left-2 flex max-h-[70vh] -translate-y-1/2 [scrollbar-width:none] flex-col overflow-y-auto py-1 @max-4xl:hidden [&::-webkit-scrollbar]:hidden"
    >
      {sections.map((section) => (
        <SectionTick
          key={section.id}
          section={section}
          active={section.id === activeId}
          onSelect={() => onSelect(section.id)}
        />
      ))}
    </nav>
  );
}

function SectionTick({
  section,
  active,
  onSelect,
}: {
  section: ConversationSection;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={150}
        closeDelay={80}
        render={
          <button
            type="button"
            onClick={onSelect}
            aria-current={active ? "true" : undefined}
            aria-label={`Question ${section.index}: ${section.headline}`}
            className="group flex h-3.5 w-8 shrink-0 items-center justify-start pl-1"
          />
        }
      >
        <span
          className={cn(
            "h-0.5 rounded-full transition-[width,background-color] duration-160 ease-out",
            active
              ? "w-5 bg-foreground"
              : "w-3 bg-muted-foreground/40 group-hover:w-4 group-hover:bg-muted-foreground"
          )}
        />
      </PreviewCardTrigger>
      <PreviewCardContent side="right" align="center" className="w-80 gap-1.5">
        <p className="line-clamp-2 font-medium break-words">
          {section.headline}
        </p>
        {section.attachmentCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconPhoto className="size-3.5 shrink-0" />
            {section.attachmentCount === 1
              ? "1 image"
              : `${section.attachmentCount} images`}
          </div>
        )}
        {section.reply.length > 0 && (
          <p className="line-clamp-4 text-xs leading-relaxed break-words text-muted-foreground">
            {section.reply}
          </p>
        )}
      </PreviewCardContent>
    </PreviewCard>
  );
}
