import type { ReactNode } from "react";

import { SiteFooter } from "#/components/site-footer";
import { SiteHeader } from "#/components/site-header";

/**
 * Every page: the header, the page, and the footer held to the bottom of the
 * window when the page is shorter than it.
 */
export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
