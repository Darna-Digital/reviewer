import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 41811 is the embedded server and 41812 the spa; the brand studio takes the
// next port in the reviewer block so all three can run side by side in cmux.
export default defineConfig({
  base: "/",
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact()],
  server: { port: 41813 },
  preview: { port: 41813 },
});
