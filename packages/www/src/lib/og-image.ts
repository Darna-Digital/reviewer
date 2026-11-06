import { SITE_URL } from "#/lib/links";

/**
 * The meta tags for a social card from public/og (scripts/og-image renders
 * them). The root sets the site's card; a page that has its own passes it
 * in its head, and TanStack keeps the deepest route's tag of each name.
 */
export function ogImage(name: string, alt: string) {
  const url = `${SITE_URL}/og/${name}.png`;
  return [
    { property: "og:image", content: url },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: alt },
    { name: "twitter:image", content: url },
    { name: "twitter:image:alt", content: alt },
  ];
}
