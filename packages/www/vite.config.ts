import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fumadocsMdx } from "fumadocs-mdx/vite";

const PORT = 41822;

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: PORT },
  preview: { port: PORT },
  plugins: [
    devtools(),
    fumadocsMdx(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
