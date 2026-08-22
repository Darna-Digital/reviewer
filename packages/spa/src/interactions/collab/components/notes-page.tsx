/**
 * A project's notes — a list beside whichever one is open.
 *
 * A note is a doc, so this is the docs surface under another name: a title, a
 * markdown body, and a save. What it is not is a rich editor — the body is a
 * textarea, because the content is markdown and a note is something you write
 * quickly rather than lay out.
 *
 * Which note is open rides in the search rather than in a store, unlike the
 * bottom drawer: a note is somewhere you have gone, so the back button should
 * take you out of it and a link to one should open it.
 */
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCollabNote, useCollabProject } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import { notesPath, projectPath } from "../functions/collab-layout.functions";
import { CollabEmpty, CollabPanel, CollabTitle } from "./collab-column";
import { ProjectMark } from "./project-mark";

function Editor({ noteId }: { readonly noteId: string }) {
  const note = useCollabNote(noteId);
  const actions = useCollabActions();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);

  // The draft is dropped whenever the note under it changes, so opening a
  // second note does not show the first one's unsaved body.
  useEffect(() => setDraft(null), [noteId]);

  if (note.data === undefined) {
    return (
      <CollabPanel>
        <CollabEmpty>{note.isPending ? "Loading…" : "Not here."}</CollabEmpty>
      </CollabPanel>
    );
  }

  const content = draft ?? note.data.content;
  const dirty = draft !== null && draft !== note.data.content;

  return (
    <CollabPanel className="flex flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {note.data.title}
        </h2>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
          {dirty ? "Unsaved" : `Saved ${timeAgo(note.data.updatedAt)}`}
        </span>
        <Button
          size="xs"
          disabled={!dirty}
          onClick={() => {
            void actions.saveNote(noteId, content).then(() => setDraft(null));
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete note"
          onClick={() => {
            void actions.removeNote(noteId).then(() => {
              void navigate({ to: notesPath(note.data.projectId), search: {} });
            });
          }}
        >
          <IconTrash />
        </Button>
      </header>
      <Textarea
        value={content}
        aria-label={`${note.data.title} body`}
        placeholder="Write it in markdown…"
        className="min-h-72 resize-y rounded-none border-0 font-mono text-[13px] shadow-none focus-visible:ring-0"
        onChange={(event) => setDraft(event.target.value)}
      />
    </CollabPanel>
  );
}

export function NotesPage({ projectId }: { readonly projectId: string }) {
  const detail = useCollabProject(projectId);
  const search = useSearch({ strict: false });
  const actions = useCollabActions();
  const navigate = useNavigate();

  if (detail.data === undefined) {
    return (
      <CollabPanel>
        <CollabEmpty>{detail.isPending ? "Loading…" : "Not here."}</CollabEmpty>
      </CollabPanel>
    );
  }

  const { project, notes } = detail.data;
  const openId = search.note;

  return (
    <>
      <CollabTitle
        eyebrow={
          <>
            <ProjectMark color={project.color} className="size-3" />
            <Link
              to={projectPath(project.id)}
              className="hover:text-foreground"
            >
              {project.name}
            </Link>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void actions.createNote("", project.id).then((created) => {
                void navigate({
                  to: notesPath(project.id),
                  search: { note: created.id },
                });
              });
            }}
          >
            <IconPlus data-icon="inline-start" />
            New note
          </Button>
        }
      >
        Notes
      </CollabTitle>

      <div className="flex flex-col gap-4">
        <CollabPanel className="divide-y">
          {notes.length === 0 ? (
            <CollabEmpty>Nothing written down yet.</CollabEmpty>
          ) : (
            <div className="flex flex-col py-1">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  to={notesPath(project.id)}
                  search={{ note: note.id }}
                  className={cn(
                    "flex min-w-0 items-center gap-2 px-3 py-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate",
                    note.id === openId && "bg-elevate-strong"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                    {timeAgo(note.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CollabPanel>

        {openId !== undefined && <Editor noteId={openId} />}
      </div>
    </>
  );
}
