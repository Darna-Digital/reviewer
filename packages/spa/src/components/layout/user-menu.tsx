/**
 * UserMenu — who is signed in, at the far end of the window bar. It is the one
 * control that never changes with the surface below it, so it holds the corner
 * in every mode and carries the account-level actions with it.
 *
 * The account itself is still the prototype's mock viewer; only the menu around
 * it is real.
 */
import { IconLogout, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VIEWER } from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

export function UserMenu({ className }: { className?: string }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Account — ${VIEWER.name}`}
            className={cn("rounded-full", className)}
          />
        }
      >
        <Avatar name={VIEWER.name} letters={1} className="size-6" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={VIEWER.name} className="size-8 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {VIEWER.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {VIEWER.email}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
          <IconUserCircle className="size-4 shrink-0" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
          <IconSettings className="size-4 shrink-0" />
          Settings
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <IconLogout className="size-4 shrink-0" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
