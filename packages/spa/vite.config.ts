import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const SERVER_URL = process.env.REVIEWER_SERVER_URL ?? "http://localhost:41811";
const isProduction = process.env.NODE_ENV === "production";

// Assets are always referenced from the root of the origin, never relative to
// the document. The desktop shell serves the built client over a custom
// `reviewer://` scheme and the router rewrites the address as you navigate, so
// document-relative URLs resolve against whatever route is open — reloading on
// `/modes/code/branches` would look for `/modes/code/assets/...`, get the HTML
// shell back from the catch-all, and come up blank.
const config = defineConfig({
  base: "/",
  resolve: { tsconfigPaths: true },
  // No SSR — reviewer is a local single-page app served behind the API server.
  plugins: [
    ...(!isProduction ? [devtools()] : []),
    tailwindcss(),
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
  server: {
    port: 41812,
    proxy: {
      // `ws: true` also proxies the live-terminal PTY WebSocket upgrade
      // (/api/threads/pty) through to the API server.
      "/api": { target: SERVER_URL, changeOrigin: true, ws: true },
    },
  },
  // The desktop shell loads the built SPA via `vite preview` in prod; keep the
  // port and `/api` proxy aligned with the dev server above.
  preview: {
    port: 41812,
    proxy: {
      // `ws: true` also proxies the live-terminal PTY WebSocket upgrade
      // (/api/threads/pty) through to the API server.
      "/api": { target: SERVER_URL, changeOrigin: true, ws: true },
    },
  },
});

export default config;
