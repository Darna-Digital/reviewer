/**
 * The TanStack devtools panels, in a module of their own.
 *
 * They used to be imported straight into `__root`, guarded only by a runtime
 * check (`!isDesktop && !isPreviewWindow`). A runtime guard decides what
 * *renders*; it has no say in what gets *bundled*, so all three devtools
 * packages — router, query, and the panel host that frames them — were linked
 * into the production graph and preloaded on first paint. That is ~190 KB of
 * JavaScript downloaded, parsed and thrown away by every user of a release
 * build, none of whom can open a panel.
 *
 * Keeping them behind their own module lets `__root` reach for them through a
 * dynamic import inside an `import.meta.env.DEV` branch. Vite replaces that
 * flag with a literal `false` in a production build, the branch becomes dead
 * code, and the import goes with it — the panels exist in dev and are absent
 * from the release, rather than merely hidden in it.
 */
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export default function Devtools() {
  return (
    <TanStackDevtools
      config={{ position: "bottom-right" }}
      plugins={[
        { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
        { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
      ]}
    />
  );
}
