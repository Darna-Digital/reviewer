/**
 * What the centre pane says while nothing is open: the ways to put something
 * there, each with the keys that do it.
 *
 * Read rather than decorated — an IDE's empty editor, where the blank canvas is
 * the one place there is room to teach the gestures, and where showing them is
 * more use than an illustration. Every line is also a button, so the shortcut
 * can be learned without being used first. Inside the shell the gestures are
 * the shell's own — its palette, its settings window — so the click crosses
 * over rather than opening the page's dialog under a native one.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  openSearch,
  toggleCommandSearch,
} from "@/interactions/search/adapters/search.store";
import { island, shell, type ShellOpenTarget } from "@/lib/shell";

interface Way {
  readonly label: string;
  readonly keys: string;
  readonly target: ShellOpenTarget;
  readonly run: () => void;
}

export function EmptyPane({ hint }: { hint: string }) {
  const navigate = useNavigate();

  const ways: ReadonlyArray<Way> = [
    {
      label: "Commands",
      keys: "⌘K",
      target: "commands",
      run: toggleCommandSearch,
    },
    {
      label: "Find a file",
      keys: "Double ⇧",
      target: "files",
      run: () => openSearch("files"),
    },
    {
      label: "Search file contents",
      keys: "⌘⇧F",
      target: "text",
      run: () => openSearch("text"),
    },
    {
      label: "Settings",
      keys: "⌘,",
      target: "settings",
      run: () => void navigate({ to: "/settings" }),
    },
  ];

  const open = (way: Way) => {
    if (island !== undefined) {
      void shell.post({ type: "open", target: way.target });
      return;
    }
    way.run();
  };

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex flex-col items-start gap-3">
        {ways.map((way) => (
          <button
            key={way.label}
            type="button"
            onClick={() => open(way)}
            className="flex items-baseline gap-2 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {way.label}
            <span className="text-muted-foreground/60">{way.keys}</span>
          </button>
        ))}
        <p className="text-sm text-muted-foreground/60">{hint}</p>
      </div>
    </div>
  );
}
