/**
 * Where the session runs — this machine, or one of the workspace's cloud
 * environments. It opens the composer's context strip because it is the
 * outermost of the answers the strip gives: which project/runtime, then which
 * branch.
 *
 * It keeps the historical project-chip shape — project mark, project label, and
 * chevron — while the menu behind it now chooses local vs cloud. The badge on
 * the project mark mirrors that choice: a computer for local and a cloud for a
 * workspace environment.
 *
 * The cloud environments are placeholders — nothing runs there yet, so choosing
 * one only moves this control's own selection.
 */
import {
  IconCheck,
  IconChevronDown,
  IconCloud,
  IconDeviceLaptop,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectAvatar } from "@/interactions/workspace/components/project-avatar";
import { useSurfaceBackground } from "@/lib/surface-context";
import { cn } from "@/lib/utils";

interface CloudEnvironment {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
}

const CLOUD_ENVIRONMENTS: ReadonlyArray<CloudEnvironment> = [
  { id: "cloud-standard", name: "Standard", detail: "4 vCPU · 8 GB" },
  { id: "cloud-large", name: "Large", detail: "16 vCPU · 32 GB" },
];

const THIS_DEVICE = "local";

export function DeviceSwitcher({
  device,
  project,
  side = "top",
}: {
  /** What this machine calls itself; undefined until the workspace answers. */
  device: string | undefined;
  /** The open project, whose mark the chip wears. */
  project: string | undefined;
  side?: "top" | "bottom";
}) {
  const [selected, setSelected] = useState(THIS_DEVICE);
  const [open, setOpen] = useState(false);

  const cloud = CLOUD_ENVIRONMENTS.find((env) => env.id === selected);
  const deviceName = device ?? "this device";
  const projectLabel = project ?? "This project";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip disabled={open}>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="chip"
                  className="max-w-56 shrink-0 gap-2 px-2 py-1.5"
                  aria-label="Where this session runs"
                >
                  <RuntimeMark project={project} cloud={cloud !== undefined} />
                  <span className="truncate">{projectLabel}</span>
                  <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side={side}>
          {cloud === undefined
            ? `${projectLabel} runs locally on ${deviceName}`
            : `${projectLabel} runs in the workspace cloud · ${cloud.name}`}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side={side} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Local</DropdownMenuLabel>
          <EnvironmentRow
            icon={IconDeviceLaptop}
            label="Local"
            detail={device}
            selected={cloud === undefined}
            onSelect={() => setSelected(THIS_DEVICE)}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspace cloud</DropdownMenuLabel>
          {CLOUD_ENVIRONMENTS.map((env) => (
            <EnvironmentRow
              key={env.id}
              icon={IconCloud}
              label={env.name}
              detail={env.detail}
              selected={env.id === selected}
              onSelect={() => setSelected(env.id)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The project's own mark, badged with the place where the session runs.
 */
function RuntimeMark({
  project,
  cloud,
}: {
  project: string | undefined;
  cloud: boolean;
}) {
  const surface = useSurfaceBackground();
  if (project === undefined) {
    return (
      <span className="flex size-5 items-center justify-center">
        {cloud ? (
          <IconCloud className="size-4 text-muted-foreground" />
        ) : (
          <IconDeviceLaptop className="size-4 text-muted-foreground" />
        )}
      </span>
    );
  }
  return (
    <span className="relative flex shrink-0">
      <ProjectAvatar name={project} />
      <span
        className={cn(
          "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full p-px",
          surface
        )}
      >
        {cloud ? (
          <IconCloud className="size-3 text-muted-foreground" />
        ) : (
          <IconDeviceLaptop className="size-3 text-muted-foreground" />
        )}
      </span>
    </span>
  );
}

function EnvironmentRow({
  icon: Icon,
  label,
  detail,
  selected,
  onSelect,
}: {
  icon: typeof IconCloud;
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className={cn(selected && "text-foreground")}
      onClick={onSelect}
    >
      {selected ? (
        <IconCheck className="size-3.5 shrink-0" />
      ) : (
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={cn("truncate", selected && "font-medium")}>{label}</span>
      {detail !== undefined && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {detail}
        </span>
      )}
    </DropdownMenuItem>
  );
}
