import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

/** The MDX under content/docs, compiled by the fumadocsMdx Vite plugin. */
export const docs = defineDocs({
  dir: "content/docs",
  docs: { async: true },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
});
