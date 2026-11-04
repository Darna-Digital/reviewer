import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Lightbox } from "fumadocs-ui/components/image-zoom";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { Suspense, use } from "react";

import { Logo } from "#/components/logo";
import { useMDXComponents } from "#/components/mdx";
import { docs, source } from "#/lib/docs-source";
import { SITE_URL } from "#/lib/links";
import docsCss from "../../docs.css?url";

const serverLoader = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const data = await serverLoader({
      data: params._splat?.split("/").filter(Boolean) ?? [],
    });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} · Reviewer docs` : "Docs";
    const description = loaderData?.description;
    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:url", content: `${SITE_URL}${loaderData?.url ?? ""}` },
        ...(description
          ? [
              { name: "description", content: description },
              { property: "og:description", content: description },
            ]
          : []),
      ],
      // Fumadocs' styles switch Tailwind's `dark:` to a `.dark` class, so they
      // load on the docs alone and leave the rest of the site on the media query.
      links: [{ rel: "stylesheet", href: docsCss }],
    };
  },
  component: Page,
});

function Content({ path }: { path: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);

  const { toc } = use(page.load());
  const MDX = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        {/* One viewer for the page's screenshots: arrows step between them. */}
        <Lightbox>
          <MDX components={useMDXComponents()} />
        </Lightbox>
      </DocsBody>
    </DocsPage>
  );
}

function Page() {
  const { path, pageTree } = useFumadocsLoader(Route.useLoaderData());

  return (
    // The docs follow the system's appearance, as the rest of the site does.
    <RootProvider theme={{ defaultTheme: "system", enableSystem: true }}>
      <DocsLayout
        containerProps={{
          // Under the site header from md up, and as wide as it: the header's
          // column (Container) plus the sidebar's own 16px inset on each side,
          // so the search box lines up with the logo.
          className:
            "md:[--fd-banner-height:var(--spacing-header)] [--fd-layout-width:1006px] lg:[--fd-layout-width:1246px]",
        }}
        // On the page's own background, with no collapse button, as the
        // site's other pages have no panels.
        sidebar={{ collapsible: false, className: "bg-fd-background" }}
        // The site header carries the logo from md up; this bar is the phone's.
        nav={{ title: <Logo className="h-4 w-auto md:hidden" />, url: "/" }}
        themeSwitch={{ enabled: false }}
        tree={pageTree}
      >
        <Suspense>
          <Content path={path} />
        </Suspense>
      </DocsLayout>
    </RootProvider>
  );
}
