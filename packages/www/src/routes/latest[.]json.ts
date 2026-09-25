// What app builds from before Sparkle (0.0.4 and older) ask on launch to
// learn whether a newer build is out; they offer the release page for a
// download by hand. Builds since read the appcast.xml attached to each GitHub
// release instead (see the app's `UpdateCheck`), so this file only has to
// get those older installs onto one of them.
//
// The version is the root package.json's, read at build time — the same one
// `bundle.sh` stamps into the app. release.yml redeploys the site once a
// release is published, so the file only moves on once the disk image it
// points at exists.
import { createFileRoute } from "@tanstack/react-router";

import { version } from "../../../../package.json";

const RELEASES_URL = "https://github.com/Darna-Digital/reviewer/releases";

export const Route = createFileRoute("/latest.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { version, url: `${RELEASES_URL}/tag/v${version}` },
          { headers: { "Cache-Control": "public, max-age=300" } }
        ),
    },
  },
});
