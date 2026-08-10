/** A project's docs — one row each, newest work first. */
import { IconFileText, IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  projectDocs,
  type MockProject,
} from "@/interactions/collaboration/data/collaboration.mock";

export function DocsView({ project }: { project: MockProject }) {
  const docs = projectDocs(project.id);

  return (
    <>
      <PaneHeader
        foot
        crumbs={[
          <Link
            key="project"
            to="/modes/collaboration"
            search={{ view: "project", id: project.id }}
            className="truncate text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {project.name}
          </Link>,
          <span key="docs" className="font-medium">
            Docs
          </span>,
        ]}
        meta={`${docs.length} ${docs.length === 1 ? "doc" : "docs"}`}
        actions={
          <Button variant="ghost" size="sm" className="gap-1.5 pr-2.5 pl-1.5">
            <IconPlus className="size-4" />
            New doc
          </Button>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <ul role="list">
          {docs.map((doc) => (
            <li key={doc.id} className="border-b">
              <button
                type="button"
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
              >
                <IconFileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium">
                      {doc.title}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {doc.updated}
                    </span>
                  </span>
                  <span className="mt-0.5 flex min-w-0 gap-1.5 text-[13px] text-muted-foreground">
                    <span className="truncate">{doc.summary}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {docs.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No docs in this project yet.
          </p>
        )}
      </ScrollArea>
    </>
  );
}
