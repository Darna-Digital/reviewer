import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { SITE_URL } from "#/lib/links";
import appCss from "../styles.css?url";

const TITLE = "Reviewer: Understand AI-generated code";
const DESCRIPTION =
  "In a world where we no longer write code, we spend a lot more time reviewing it. Reviewer is a delightful, smooth macOS app built precisely for that.";
const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: "1200",
  height: "630",
  alt: "Reviewer: Understand AI-generated code, above a side-by-side diff in the app",
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Reviewer" },
      { property: "og:url", content: SITE_URL },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: OG_IMAGE.url },
      { property: "og:image:width", content: OG_IMAGE.width },
      { property: "og:image:height", content: OG_IMAGE.height },
      { property: "og:image:alt", content: OG_IMAGE.alt },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE.url },
      { name: "twitter:image:alt", content: OG_IMAGE.alt },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "48x48",
      },
      {
        rel: "icon",
        href: "/favicon-light.png",
        type: "image/png",
        sizes: "96x96",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/favicon-dark.png",
        type: "image/png",
        sizes: "96x96",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html className="scheme-light-dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
