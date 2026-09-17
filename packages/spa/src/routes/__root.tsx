import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { Alerts } from "@/components/ui/alerts";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isDesktop } from "@/lib/desktop";
import { isPreviewWindow } from "@/lib/preview-window";
import type { RouterContext } from "../router";
import appCss from "../styles.css?url";

/**
 * Dev only, and dead code in a release: `import.meta.env.DEV` is replaced with
 * a literal `false` at build time, so the whole conditional — and the dynamic
 * import inside it — is dropped before the panels can reach the bundle. See
 * `@/components/devtools`.
 */
const Devtools = import.meta.env.DEV
  ? lazy(() => import("@/components/devtools"))
  : null;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Reviewer" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: () => (
    <main className="flex min-h-svh flex-col items-center justify-center gap-1 text-sm">
      <h1 className="text-base font-medium">404</h1>
      <p className="text-muted-foreground">
        The requested page could not be found.
      </p>
    </main>
  ),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Apply the persisted theme, and flag the native shell, before paint —
            the frame is translucent there, and a flash of opaque chrome while
            the vibrancy layer waits is the exact thing this avoids.

            The shell is looked for in the window this document hangs in as well
            as in this one: a preview frame gets no preload of its own, and a
            picture drawn without the flag is a picture of the app as the
            browser wears it. See `lib/desktop`.

            An island — one part of the app in a web view of the macOS shell's
            own (see `lib/shell`) — is flagged too, for the styles that take the
            frame off the page, and takes the theme from the appearance the
            shell names rather than from the media query: inside the sidebar's
            vibrancy that query answers for a variant WebKit does not read as
            dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const r=document.documentElement;const t=localStorage.getItem("reviewer-theme")||"system";let a=null;try{a=(window.reviewer&&window.reviewer.appearance)||null}catch(e){}const d=t==="dark"||(t!=="light"&&(a?a==="dark":matchMedia("(prefers-color-scheme: dark)").matches));r.classList.toggle("dark",d);r.dataset.theme=d?"dark":"light";let k=false;try{k="reviewer" in window||(window!==parent&&"reviewer" in parent)}catch(e){}r.classList.toggle("desktop",k);let i="";try{i=(window.reviewer&&window.reviewer.island)||""}catch(e){}r.classList.toggle("island",i!=="");if(i)r.dataset.island=i;const p=JSON.parse(localStorage.getItem("reviewer-ui")||"{}");r.classList.toggle("translucent",p.translucency!==false);}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <TooltipProvider delay={300}>{children ?? <Outlet />}</TooltipProvider>
        <Toaster />
        <Alerts />
        {/* Devtools only in the browser, not inside the Electron shell — and
            never in a preview frame, which would boot a second set of panels
            for a picture of a page. In a release build `Devtools` is null and
            the panels were never bundled at all. */}
        {Devtools !== null && !isDesktop && !isPreviewWindow && (
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  );
}
