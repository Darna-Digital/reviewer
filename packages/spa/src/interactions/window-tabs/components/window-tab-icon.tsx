/**
 * What a window tab wears. The pinned three are their icon and nothing else in
 * the strip, so the mark is the whole of the tab; a session tab is its title
 * there and takes the mark only where there is room for both — the overview.
 */
import {
  IconCode,
  IconMessage,
  IconSend,
  IconUsersGroup,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { WindowTabKind } from "../interfaces/window-tabs.interfaces";

const ICONS: Record<WindowTabKind, typeof IconCode> = {
  project: IconCode,
  collaboration: IconUsersGroup,
  sessions: IconSend,
  session: IconMessage,
};

export function WindowTabIcon({
  kind,
  className,
}: {
  readonly kind: WindowTabKind;
  readonly className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon className={cn("size-4 shrink-0", className)} />;
}
