import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const SERVER_URL = process.env.BYCONVO_SERVER_URL ?? "http://localhost:41811"
// The shared workspace API (projects, issues, docs) and better-auth live on
// their own server. Proxying keeps the session cookie same-origin in the
// browser; the rewrite lets paths be written as that server sees them.
const CENTRAL_URL = process.env.BYCONVO_CENTRAL_URL ?? "http://localhost:41821"
const isProduction = process.env.NODE_ENV === "production"

const config = defineConfig({
  base: isProduction ? "./" : "/",
  resolve: { tsconfigPaths: true },
  // No SSR — byconvo is a local single-page app served behind the API server.
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
      "/central-api": {
        target: CENTRAL_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/central-api/, ""),
      },
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
      "/central-api": {
        target: CENTRAL_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/central-api/, ""),
      },
    },
  },
})

export default config
