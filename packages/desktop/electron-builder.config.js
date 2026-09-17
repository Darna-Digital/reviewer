// Channel-aware electron-builder configuration.
//
// REVIEWER_CHANNEL selects the app identity and the GitHub repository that
// releases are published to and that auto-updates are fetched from. Because
// each channel has a distinct appId and productName, a "Reviewer Beta" install
// coexists with a production "Reviewer" install and updates on its own feed —
// beta from darna-digital/reviewer-beta, production from darna-digital/reviewer.
//
// Defaults to prod so a local `pnpm dist:desktop` (no channel set) behaves like
// a production build.

const channel = (() => {
  const raw = process.env.REVIEWER_CHANNEL;
  return raw === "beta" || raw === "prod" ? raw : "prod";
})();

const identities = {
  beta: {
    appId: "com.byconvo.desktop.beta",
    productName: "Reviewer Beta",
    publish: {
      provider: "github",
      owner: "darna-digital",
      repo: "reviewer-beta",
      releaseType: "release",
    },
  },
  prod: {
    appId: "com.byconvo.desktop",
    productName: "Reviewer",
    publish: {
      provider: "github",
      owner: "darna-digital",
      repo: "reviewer",
      releaseType: "release",
    },
  },
};

const { appId, productName, publish } = identities[channel];

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId,
  productName,
  // Space-free artifact name so the file electron-updater downloads is stable
  // across channels; the version already carries the -beta.N suffix on beta.
  artifactName: "Reviewer-${version}-${os}-${arch}.${ext}",
  asar: true,

  // @lydell/node-pty ships prebuilt, ABI-stable (N-API) binaries per platform,
  // so no native rebuild is needed — the matching prebuilt loads under Electron's
  // Node (ELECTRON_RUN_AS_NODE) as-is, on both arm64 and x64.
  npmRebuild: false,
  // Native modules can't be dlopen'd from inside the asar, so keep the pty binary
  // (and any other .node) unpacked. The prebuilt and its spawn-helper live in the
  // per-platform @lydell/node-pty-<os>-<arch> package.
  asarUnpack: ["**/*.node", "**/node_modules/@lydell/**"],

  directories: { output: "dist-packaged" },

  files: [
    { from: "dist", to: "dist", filter: ["**/*"] },
    // The Icon Composer bundle and the SVGs the dock PNGs are rendered from are
    // build-time input only; the PNGs stay, the running app paints them onto
    // the dock (see main.ts).
    {
      from: "assets",
      to: "assets",
      filter: ["**/*", "!Reviewer.icon{,/**}", "!*.svg"],
    },
    { from: "../spa/dist/client", to: "renderer", filter: ["**/*"] },
    { from: "../embedded-server/dist", to: "server", filter: ["**/*"] },
    // Production dependencies (@lydell/node-pty + its platform binary packages,
    // electron-updater). electron-builder prunes this to the production
    // dependency tree, so devDeps (electron, etc.) are skipped.
    "node_modules/**/*",
    "package.json",
  ],

  mac: {
    category: "public.app-category.developer-tools",
    // An Icon Composer bundle rather than a plain .icns: macOS 26 draws legacy
    // .icns icons shrunken inside a system glass tile ("icon jail"), so a
    // full-size dock icon needs the layered format, which electron-builder
    // compiles into an asset catalog (plus a derived .icns for older macOS) with
    // actool — packaging therefore needs Xcode 26+ selected, on CI too.
    icon: "assets/Reviewer.icon",
    // Gatekeeper requires distributed apps to be signed with a Developer ID
    // certificate and notarized. `identity` is left unset so electron-builder
    // auto-discovers the "Developer ID Application" cert imported into the CI
    // keychain; hardenedRuntime + entitlements are prerequisites for
    // notarization, which runs via the APPLE_API_* env vars.
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "assets/entitlements.plist",
    entitlementsInherit: "assets/entitlements.plist",
    notarize: true,
    // dmg for first install; zip is what electron-updater downloads to self-update.
    target: ["dmg", "zip"],
  },

  // electron-updater reads this from the baked-in app-update.yml to find new
  // releases on the channel's repo.
  publish,
};
