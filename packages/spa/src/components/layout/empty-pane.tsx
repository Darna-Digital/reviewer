/**
 * What the centre pane says while nothing is open: the ways to put something
 * there, each with the keys that do it.
 *
 * Read rather than decorated — an IDE's empty editor, where the blank canvas is
 * the one place there is room to teach the gestures, and where showing them is
 * more use than an illustration. Every line is also a button, so the shortcut
 * can be learned without being used first.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  openSearch,
  toggleCommandSearch,
} from "@/interactions/search/adapters/search.store";

interface Way {
  readonly label: string;
  readonly keys: string;
  readonly run: () => void;
}

export function EmptyPane({ hint }: { hint: string }) {
  const navigate = useNavigate();

  const ways: ReadonlyArray<Way> = [
    { label: "Commands", keys: "⌘K", run: toggleCommandSearch },
    { label: "Find a file", keys: "Double ⇧", run: () => openSearch("files") },
    {
      label: "Search file contents",
      keys: "⌘⇧F",
      run: () => openSearch("text"),
    },
    {
      label: "Settings",
      keys: "⌘,",
      run: () => void navigate({ to: "/settings" }),
    },
  ];

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex flex-col items-start gap-3">
        {ways.map((way) => (
          <button
            key={way.label}
            type="button"
            onClick={way.run}
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
