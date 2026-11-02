// The TUI's one-line install, `curl -fsSL https://reviewer.sh/install | bash`.
//
// The script itself lives beside the TUI it installs
// (packages/tui/release/install.sh) and is read at build time, so the site
// serves the one the repository has. It holds no version: it asks the latest
// GitHub release's install-manifest.txt what to fetch, so it never needs
// redeploying for a release to reach new installs.
import { createFileRoute } from "@tanstack/react-router";

import script from "../../../tui/release/install.sh?raw";

export const Route = createFileRoute("/install")({
  server: {
    handlers: {
      GET: () =>
        new Response(script, {
          headers: {
            "Content-Type": "text/x-shellscript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
