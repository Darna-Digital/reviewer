"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { cn } from "@/lib/utils";
import {
  ELEVATION,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { Button } from "@/components/ui/button";

/* The dialog you cannot dismiss by looking away. Everything here is the same
   shape as `dialog.tsx` — same overlay, same lift off the surface ladder, same
   header/footer slots — and the differences are the ones the role asks for: no
   close cross, no click-outside, and a footer that always names both answers.
   A question that blocks the thing you just asked for has to be answered, not
   waved away, which is exactly what `window.confirm` got right and nothing
   else about it did. */

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  const { level, className: surface } = useElevation(ELEVATION.dialog);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-surface={level}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-xl p-6 text-sm text-popover-foreground duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          surface,
          className
        )}
        {...props}
      >
        <SurfaceProvider value={level}>{children}</SurfaceProvider>
      </AlertDialogPrimitive.Popup>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-base leading-snug font-medium text-balance",
        className
      )}
      {...props}
    />
  );
}

/* The thing the question is about — the path, the branch, the file — kept out
   of the question itself and given a line of its own.

   A heading that ends in a full repository path is a heading that wraps three
   times, breaks mid-word, and pushes the answer off the bottom of the sheet,
   and it does it worse the more of the sentence there is to push. The question
   above stays one short line at every width; the subject sits below it in the
   monospace the rest of the app gives paths, on exactly one line however long
   it is.

   It is ellipsised from the *front*, which is what `dir="rtl"` buys: the end of
   a path — the file's own name — is what identifies it, and the head is the
   part that can be spent. `<bdi>` keeps the text itself running left to right
   inside that flipped box. */
function AlertDialogSubject({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-subject"
      className={cn(
        "flex min-w-0 rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-foreground shadow-[inset_0_0_0_0.5px_var(--border)]",
        className
      )}
      title={typeof children === "string" ? children : undefined}
      {...props}
    >
      <span dir="rtl" className="min-w-0 truncate text-left select-text">
        <bdi>{children}</bdi>
      </span>
    </div>
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-pretty whitespace-pre-line text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

/** The answer that goes ahead. `destructive` paints it as the filled red one. */
function AlertDialogAction({
  className,
  destructive = false,
  ...props
}: AlertDialogPrimitive.Close.Props & { destructive?: boolean }) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={
        <Button
          variant={destructive ? "destructive" : "default"}
          className={className}
        />
      }
      {...props}
    />
  );
}

/** The answer that changes nothing. */
function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant="outline" className={className} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogSubject,
  AlertDialogTitle,
  AlertDialogTrigger,
};
