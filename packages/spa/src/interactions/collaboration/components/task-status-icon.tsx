import {
  IconCircleCheckFilled,
  IconCircleDashed,
  IconProgress,
  IconProgressCheck,
  IconProgressHelp,
} from "@tabler/icons-react";
import type { TaskStatus } from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

const ICON = {
  todo: IconCircleDashed,
  figuring: IconProgressHelp,
  doing: IconProgress,
  review: IconProgressCheck,
  done: IconCircleCheckFilled,
};

const COLOR = {
  todo: "text-muted-foreground",
  figuring: "text-violet-600 dark:text-violet-400",
  doing: "text-amber-600 dark:text-amber-400",
  review: "text-brand-600 dark:text-brand-400",
  done: "text-emerald-600 dark:text-emerald-400",
};

export function TaskStatusIcon({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const Icon = ICON[status];
  return <Icon className={cn("size-4 shrink-0", COLOR[status], className)} />;
}
