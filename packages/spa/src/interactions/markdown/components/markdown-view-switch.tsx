/**
 * The segmented control that picks how a markdown file is being read.
 *
 * It lives in the trail's actions slot beside the file's other readouts, where
 * every per-file control in this app lives, rather than floating over the
 * document — a control that moves with the content it changes is a control you
 * have to find twice.
 */
import { IconCode, IconColumns2, IconFileText } from "@tabler/icons-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MARKDOWN_VIEWS,
  type MarkdownView,
} from "../interfaces/markdown.interfaces";

const OPTIONS: Readonly<
  Record<MarkdownView, { label: string; icon: typeof IconCode }>
> = {
  source: { label: "Markdown source", icon: IconCode },
  split: { label: "Source and document", icon: IconColumns2 },
  editor: { label: "Document", icon: IconFileText },
};

export function MarkdownViewSwitch({
  view,
  onChange,
}: {
  view: MarkdownView;
  onChange: (view: MarkdownView) => void;
}) {
  return (
    <ToggleGroup
      className="w-[72px]"
      value={[view]}
      aria-label="Markdown view"
      // Base UI hands back the whole pressed set. The group is exclusive, so
      // its one entry is the answer — and an empty set is the user pressing the
      // segment that is already lit, which changes nothing.
      onValueChange={(pressed) => {
        const next = pressed[0] as MarkdownView | undefined;
        if (next !== undefined) onChange(next);
      }}
    >
      {MARKDOWN_VIEWS.map((option) => {
        const { label, icon: Icon } = OPTIONS[option];
        return (
          <ToggleGroupItem
            key={option}
            value={option}
            aria-label={label}
            title={label}
          >
            <Icon />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
