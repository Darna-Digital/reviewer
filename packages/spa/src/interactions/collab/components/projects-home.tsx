/**
 * The collaboration home — every project, as a card.
 *
 * Basecamp's front page is a grid of the places you work rather than a feed of
 * what happened in them, and that is the choice being kept here: the page
 * answers "where am I working?", and each card answers "how far along is it?".
 * What happened is a thing you go into a project to find out.
 */
import { IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollabHome } from "@/lib/queries";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import { projectPath } from "../functions/collab-layout.functions";
import { CollabEmpty, CollabPanel, CollabTitle } from "./collab-column";
import { ProjectMark } from "./project-mark";

function NewProject() {
  const actions = useCollabActions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconPlus data-icon="inline-start" />
        New project
      </Button>
    );
  }

  const create = async () => {
    const created = await actions.createProject(name, purpose);
    // A blank name is refused rather than accepted as "Untitled": the form
    // stays open with what was typed, which is the answer to why nothing
    // happened.
    if (created === null) return;
    setName("");
    setPurpose("");
    setOpen(false);
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <Input
        autoFocus
        value={name}
        placeholder="Project name"
        aria-label="Project name"
        className="h-8 w-44"
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        value={purpose}
        placeholder="What's it about?"
        aria-label="What's it about?"
        className="h-8 w-52"
        onChange={(event) => setPurpose(event.target.value)}
      />
      <Button type="submit" size="sm">
        Create
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </form>
  );
}

export function ProjectsHome() {
  const home = useCollabHome();
  const projects = home.data ?? [];

  return (
    <>
      <CollabTitle actions={<NewProject />}>Projects</CollabTitle>

      {home.isPending ? (
        <CollabPanel>
          <CollabEmpty>Loading…</CollabEmpty>
        </CollabPanel>
      ) : projects.length === 0 ? (
        <CollabPanel>
          <CollabEmpty>
            No projects yet. Start one and it will be kept here.
          </CollabEmpty>
        </CollabPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map(({ project, progress }) => (
            <Link
              key={project.id}
              to={projectPath(project.id)}
              className="group flex flex-col gap-1 rounded-xl border bg-surface-2 p-4 shadow-surface-2 transition-colors outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <div className="flex items-center gap-2">
                <ProjectMark color={project.color} />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {project.name}
                </span>
                {project.archived && (
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                    Archived
                  </span>
                )}
              </div>
              <p className="line-clamp-2 min-h-8 text-[13px] text-muted-foreground">
                {project.purpose.length > 0
                  ? project.purpose
                  : "No description yet."}
              </p>
              <p className="text-[0.6875rem] text-muted-foreground tabular-nums">
                {progress.total === 0
                  ? "Nothing to do yet"
                  : `${progress.done} of ${progress.total} done`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
