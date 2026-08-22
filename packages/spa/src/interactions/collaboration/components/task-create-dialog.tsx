/**
 * New task — the title-bar button and the dialog behind it.
 *
 * Laid out the way Linear's issue composer is: the project it lands in reads as
 * a chip above a title you type straight into, with the properties as a row of
 * small pickers underneath rather than a stack of labelled fields. Nothing here
 * is required except a title, so the fast path is type-and-create and every
 * property is a default you can override on the way past.
 */
import { IconChevronDown, IconEdit } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { ScopeGlyph } from "@/interactions/collaboration/components/scope-glyph";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  addTask,
  agentName,
  allAgents,
  DEFAULT_SCOPE,
  findScope,
  MEMBERS,
  PROJECTS,
  SCOPES,
  STATUS_LABEL,
  STATUS_ORDER,
  UNASSIGNED,
  type MockProject,
  type TaskStatus,
} from "@/interactions/collaboration/data/collaboration.mock";

const ASSIGNEES: ReadonlyArray<string> = [
  UNASSIGNED,
  ...MEMBERS.map((m) => m.name),
  ...allAgents().map(agentName),
];

const projectMark = (project: MockProject) => (
  <span
    className="size-3 shrink-0 rounded-[0.25rem] bg-(--mark)"
    style={{ "--mark": project.color } as CSSProperties}
  />
);

/** A property pill: the current value, and a menu of the rest. */
function Picker({
  label,
  children,
  menu,
}: {
  label: string;
  children: ReactNode;
  menu: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={label}
            className="h-7 gap-1.5 rounded-lg px-2 text-[0.8125rem] font-normal"
          />
        }
      >
        {children}
        <IconChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NewTaskButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(PROJECTS[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [scopeId, setScopeId] = useState(DEFAULT_SCOPE);
  const [assignee, setAssignee] = useState(UNASSIGNED);

  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const scope = findScope(scopeId);

  const reset = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setScopeId(DEFAULT_SCOPE);
    setAssignee(UNASSIGNED);
  };

  const create = () => {
    if (title.trim() === "" || project === undefined) return;
    const task = addTask({
      projectId: project.id,
      title: title.trim(),
      status,
      scopeId,
      assignee,
      description,
    });
    reset();
    setOpen(false);
    void navigate({
      to: "/modes/experimentation/collaboration",
      search: { view: "task", id: task.id },
    });
  };

  if (project === undefined) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New task"
                  className="rounded-lg text-muted-foreground"
                />
              }
            />
          }
        >
          <IconEdit className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">New task</TooltipContent>
      </Tooltip>

      <DialogContent className="gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="flex items-center gap-2 px-4 pt-4">
          <Picker
            label="Project"
            menu={PROJECTS.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setProjectId(p.id)}>
                {projectMark(p)}
                {p.name}
              </DropdownMenuItem>
            ))}
          >
            {projectMark(project)}
            <span className="truncate">{project.name}</span>
          </Picker>
          <DialogTitle className="text-xs font-normal text-muted-foreground">
            New task
          </DialogTitle>
        </div>

        <DialogDescription className="sr-only">
          Give the task a title, then set the properties it starts with.
        </DialogDescription>

        <Input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Task title"
          aria-label="Task title"
          className="h-auto border-0 bg-transparent px-4 py-3 !text-base font-medium shadow-none focus-visible:ring-0"
        />
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add description…"
          aria-label="Description"
          className="min-h-24 resize-none border-0 bg-transparent px-4 py-0 text-sm shadow-none focus-visible:ring-0"
        />

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          <Picker
            label="Status"
            menu={STATUS_ORDER.map((value) => (
              <DropdownMenuItem key={value} onClick={() => setStatus(value)}>
                <TaskStatusIcon status={value} />
                {STATUS_LABEL[value]}
              </DropdownMenuItem>
            ))}
          >
            <TaskStatusIcon status={status} />
            {STATUS_LABEL[status]}
          </Picker>

          <Picker
            label="Horizon"
            menu={SCOPES.map((entry) => (
              <DropdownMenuItem
                key={entry.id}
                onClick={() => setScopeId(entry.id)}
                className="items-start"
              >
                <ScopeGlyph kind={entry.kind} className="mt-0.5" />
                <span className="flex min-w-0 flex-col">
                  <span>{entry.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.window}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          >
            {scope !== undefined && <ScopeGlyph kind={scope.kind} />}
            {scope?.name ?? "No horizon"}
          </Picker>

          <Picker
            label="Assignee"
            menu={ASSIGNEES.map((name) => (
              <DropdownMenuItem key={name} onClick={() => setAssignee(name)}>
                <AssigneeAvatar name={name} />
                {name}
              </DropdownMenuItem>
            ))}
          >
            <AssigneeAvatar name={assignee} />
            <span className="truncate">{assignee}</span>
          </Picker>
        </div>

        <DialogFooter className="items-center border-t px-4 py-3">
          <DialogClose render={<Button variant="ghost" size="sm" />}>
            Cancel
          </DialogClose>
          <Button size="sm" disabled={title.trim() === ""} onClick={create}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
