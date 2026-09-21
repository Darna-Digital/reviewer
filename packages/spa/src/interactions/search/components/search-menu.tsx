/**
 * The toolbar's way into search, beside the repository it searches. The dialog
 * has two lists worth opening straight into — paths and file contents — and the
 * gestures for both are hard to guess, so the menu names them and shows the
 * keys, which is what makes them learnable.
 */
import { IconFile, IconSearch, IconTextSize } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openSearch } from "../adapters/search.store";

export function SearchMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Search"
                  className="text-muted-foreground"
                />
              }
            />
          }
        >
          <IconSearch className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Search</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="min-w-56">
        <SearchMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The two lists worth opening straight into, wherever the trigger lives. The
 * rail carries its own trigger — a rail button is a shape of its own — but the
 * offer must not drift between the two.
 */
export function SearchMenuItems() {
  return (
    <>
      <DropdownMenuItem onClick={() => openSearch("files")}>
        <IconFile className="size-4 shrink-0" />
        Find a file
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => openSearch("text")}>
        <IconTextSize className="size-4 shrink-0" />
        Search file contents
      </DropdownMenuItem>
    </>
  );
}
