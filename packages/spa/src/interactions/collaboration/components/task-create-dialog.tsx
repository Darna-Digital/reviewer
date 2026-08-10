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
import { TaskPriorityIcon } from "@/interactions/collaboration/components/task-priority-icon";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  addTask,
  agentName,
  allAgents,
  MEMBERS,
  PROJECTS,
  UNASSIGNED,
  type MockProject,
  type TaskPriority,
  type TaskStatus,
} from "@/interactions/collaboration/data/collaboration.mock";

const STATUSES: ReadonlyArray<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "done", label: "Done" },
];

const PRIORITIES: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: "none", label: "No priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

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
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [assignee, setAssignee] = useState(UNASSIGNED);

  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const statusLabel = STATUSES.find((s) => s.value === status)?.label ?? "Todo";
  const priorityLabel =
    PRIORITIES.find((p) => p.value === priority)?.label ?? "No priority";

  const reset = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("none");
    setAssignee(UNASSIGNED);
  };

  const create = () => {
    if (title.trim() === "" || project === undefined) return;
    const task = addTask({
      projectId: project.id,
      title: title.trim(),
      status,
      priority,
      assignee,
      description,
    });
    reset();
    setOpen(false);
    void navigate({
      to: "/modes/collaboration",
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
                  size="icon"
                  aria-label="New task"
                  className="rounded-lg text-muted-foreground"
                />
              }
            />
          }
        >
          <IconEdit className="size-5" />
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
            menu={STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => setStatus(s.value)}
              >
                <TaskStatusIcon status={s.value} />
                {s.label}
              </DropdownMenuItem>
            ))}
          >
            <TaskStatusIcon status={status} />
            {statusLabel}
          </Picker>

          <Picker
            label="Priority"
            menu={PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p.value}
                onClick={() => setPriority(p.value)}
              >
                <TaskPriorityIcon priority={p.value} />
                {p.label}
              </DropdownMenuItem>
            ))}
          >
            <TaskPriorityIcon priority={priority} />
            {priorityLabel}
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
