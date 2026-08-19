import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import {
  AppShell,
  FixApp,
  InboxApp,
  IssueDetailApp,
} from "#/components/interfere/app";
import {
  ArrowUpRightGlyph,
  Button,
  ChevronRightGlyph,
  Container,
  HairlineDivider,
  InitialsAvatar,
  InterfereLogo,
  MonoLabel,
  ShieldGlyph,
  StarsGlyph,
} from "#/components/interfere/ui";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/interfere")({
  component: InterferePage,
});

const BRAND_GRADIENT =
  "linear-gradient(90deg, rgba(255,59,0,0.2) 0%, rgba(246,0,157,0.2) 38%, rgba(151,62,198,0.2) 71%, rgba(0,142,255,0.2) 100%)";

const NAV_LINKS = ["Product", "Careers", "Changelog", "Docs", "Contact"];

const FEATURES: ReadonlyArray<{
  index: string;
  title: string;
  description: string;
  capabilitiesLabel: string;
  capabilities: ReadonlyArray<string>;
  illustration: ReactNode;
}> = [
  {
    index: "01",
    title: "Learn about issues before your customers do",
    description:
      "Interfere continuously monitors your app and notices when behavior or outcomes change, before errors escalate or users report issues.",
    capabilitiesLabel: "Full-stack understanding",
    capabilities: [
      "User Tracking",
      "Logging & Alerting",
      "Session Replays",
      "Predictive Analysis",
      "Release Tracking",
    ],
    illustration: <InboxApp />,
  },
  {
    index: "02",
    title: "Understand what's going wrong",
    description:
      "Interfere goes beyond logs, metrics, and traces. It finds the root cause and explains what's broken, why, and who it impacts.",
    capabilitiesLabel: "Zero-touch triage",
    capabilities: [
      "Prioritization",
      "User Impact",
      "Team Routing",
      "Root Cause Analysis",
    ],
    illustration: <IssueDetailApp />,
  },
  {
    index: "03",
    title: "Fix problems with confidence",
    description:
      "Interfere turns insight into action by suggesting fixes, linking them to your codebase, and tracking progress until resolved. You're always in control.",
    capabilitiesLabel: "Built for speed & teams of any size",
    capabilities: [
      "Multiplayer Collaboration",
      "SAML/OIDC SSO",
      "Offline-first Architecture",
      "SCIM Provisioning",
      "Custom Roles & Permissions",
      "Domain Whitelisting",
    ],
    illustration: <FixApp />,
  },
];

const CHANGELOG: ReadonlyArray<{
  date: string;
  title: string;
  description: string;
}> = [
  {
    date: "MAR 12, 2026",
    title: "Introducing Consent Management",
    description:
      "We've added consent gating to our SDKs, giving you full control over which features activate based on your users' consent preferences, with native support for all modern consent platforms: c15t, CookieYes, OneTrust, or your own.",
  },
  {
    date: "FEB 11, 2026",
    title: "Timeline Improvements",
    description:
      "We've redesigned the problem timeline to better distinguish between agent findings, human actions, and external events like pull requests and CI runs, as well as new commenting features like threading.",
  },
  {
    date: "FEB 1, 2026",
    title: "OAuth applications & scoped API keys",
    description:
      "Today, we've launched support for developers to create custom OAuth applications and API keys with granular scopes on Interfere.",
  },
];

const FOOTER_COLUMNS: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<string>;
}> = [
  {
    title: "Solutions",
    links: ["Engineers", "Designers", "Product Managers", "Customer Success"],
  },
  {
    title: "Resources",
    links: ["Changelog", "Docs", "Download"],
  },
  {
    title: "Company",
    links: ["Careers", "Contact", "Security"],
  },
  {
    title: "Legal",
    links: ["Cookie Policy", "Privacy Policy", "Terms of Service"],
  },
];

function BreaksWord({ className = "" }: { className?: string }) {
  return <span className={cn("font-serif italic", className)}>breaks</span>;
}

function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/8 bg-[#fcfcfc]">
      <Container>
        <div className="grid h-14 grid-cols-2 items-center lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)]">
          <a
            aria-label="Interfere"
            className="w-max text-neutral-900"
            href="/interfere"
          >
            <InterfereLogo />
          </a>
          <nav className="hidden lg:block">
            <ul className="flex items-center justify-center gap-1">
              {NAV_LINKS.map((label) => (
                <li key={label}>
                  <a
                    className="flex h-7 items-center rounded-md px-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-black/5 hover:text-neutral-900"
                    href="#"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center justify-end gap-2">
            <Button href="#" variant="transparent">
              Login
            </Button>
            <Button href="#" variant="secondary">
              Request a demo
            </Button>
          </div>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="overflow-x-clip pt-14">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 pt-12 pb-16 lg:flex-row lg:items-end lg:gap-0 lg:pt-36 lg:pb-12">
          <h1 className="max-w-sm text-4xl leading-none font-medium tracking-[-0.02em] text-neutral-900 md:max-w-md lg:max-w-xl lg:text-[59px]">
            Ship software that never{" "}
            <BreaksWord className="tracking-[-0.03em]" />
          </h1>
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <h2 className="max-w-lg text-base font-normal text-balance text-neutral-600 lg:text-right">
              Interfere empowers engineers, product managers and designers with
              real-time understanding of previously unseen bugs and issues.
            </h2>
            <div className="flex items-center gap-4">
              <Button href="#" size="xl" variant="secondary">
                Get Early Access
              </Button>
              <Button href="#" size="xl" variant="primary">
                Request a demo
              </Button>
            </div>
          </div>
        </div>
        <div className="relative flex shrink-0 pb-4 lg:mb-16 2xl:justify-center">
          <div
            className="pointer-events-none absolute top-1/2 -left-24 h-160 w-[1496px] -translate-y-1/2 rounded-[300px] blur-[50px] md:left-1/2 md:-translate-x-1/2"
            style={{ backgroundImage: BRAND_GRADIENT }}
          />
          <AppShell className="h-160 w-full min-w-[1440px] md:h-200">
            <IssueDetailApp />
          </AppShell>
        </div>
      </Container>
    </section>
  );
}

function StatementWord({ word, index }: { word: string; index: string }) {
  return (
    <>
      <span className="relative isolate inline-block text-[#c2400b]">
        {word}
        <span
          aria-hidden="true"
          className="absolute -inset-x-1 top-1/2 -z-10 h-6 -translate-y-1/2 rounded-lg bg-[#ff3b00]/10 md:h-8"
        />
      </span>
      <span className="relative top-1 inline-flex justify-center pr-1 pl-2 align-top font-mono text-[10px] leading-none text-neutral-900">
        {index}
      </span>
    </>
  );
}

function MiniIllustration({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-50 w-full items-center justify-center rounded-2xl border border-black/8 p-1">
      {children}
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="py-16 md:py-36">
      <Container className="flex flex-col gap-10 md:gap-16">
        <h2 className="max-w-xl text-[21px] leading-snug font-medium text-pretty text-neutral-900 md:text-[28px]">
          Interfere <StatementWord index="01" word="finds" />
          issues in your app, <StatementWord index="02" word="understands" />
          what's happening, and owns{" "}
          <StatementWord index="03" word="resolution" />
          from first signal to production.
        </h2>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="flex flex-col gap-4">
            <MiniIllustration>
              <div className="flex h-full w-full flex-col items-start gap-2 overflow-hidden rounded-lg border border-black/6 bg-gradient-to-b from-neutral-50 to-transparent p-4 select-none">
                <div className="flex w-full flex-col gap-1">
                  <div className="h-2.5 w-14 rounded-xs bg-black/6" />
                  <div className="h-2.5 w-10 rounded-xs bg-black/6 opacity-70" />
                </div>
                <div className="grid w-full grid-cols-2 gap-2 pt-1">
                  <div className="relative rounded-lg bg-gradient-to-b from-black/8 to-[#b8860b] p-px">
                    <div className="h-18 w-full rounded-[7px] bg-[#fcfcfc] p-0.5">
                      <div className="h-full w-full rounded-md bg-gradient-to-br from-neutral-100 to-transparent" />
                    </div>
                    <span className="absolute -bottom-6 left-1/2 flex h-5 -translate-x-1/2 items-center rounded-full bg-[#b8860b]/10 px-2 font-mono text-[9px] whitespace-nowrap text-[#8a6508] uppercase">
                      Reset Password
                    </span>
                  </div>
                  {[0, 1, 2].map((cell) => (
                    <div
                      className="h-18 w-full rounded-lg border border-black/8 p-0.5 opacity-60"
                      key={cell}
                    >
                      <div className="h-full w-full rounded-md bg-gradient-to-br from-neutral-100 to-transparent" />
                    </div>
                  ))}
                </div>
              </div>
            </MiniIllustration>
            <div className="flex flex-col gap-2">
              <h3 className="text-[21px] font-medium text-pretty text-neutral-900">
                Learn about issues before your customers do
              </h3>
              <p className="text-base text-neutral-600">
                Interfere continuously monitors your app and notices when
                behavior or outcomes change, before errors escalate or users
                report issues.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <MiniIllustration>
              <div className="flex h-full w-full flex-col gap-2 overflow-hidden rounded-lg border border-black/6 bg-gradient-to-b from-neutral-50 to-transparent p-4 select-none">
                <div className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-black/6">
                  <span className="grid size-5 place-items-center rounded-md bg-[#ff3b00]/10">
                    <span className="size-1.5 rounded-full bg-[#ff3b00]" />
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    #112
                  </span>
                  <span className="text-[11px] font-medium text-neutral-800">
                    Reset password flow issue
                  </span>
                </div>
                {[16, 24, 12, 20].map((width, row) => (
                  <div className="flex items-center gap-2 px-2" key={width}>
                    <span className="size-1.5 rounded-full bg-black/10" />
                    <span
                      className="h-2 rounded-xs bg-black/6"
                      style={{
                        width: `${width * 4}px`,
                        opacity: 1 - row * 0.2,
                      }}
                    />
                  </div>
                ))}
                <div className="mt-auto flex items-center gap-1.5 rounded-full bg-[#973ec6]/8 px-2 py-1 text-[10px] text-[#973ec6]">
                  <StarsGlyph className="size-3" />
                  Root cause: token validation change in auth/reset.ts
                </div>
              </div>
            </MiniIllustration>
            <div className="flex flex-col gap-2">
              <h3 className="text-[21px] font-medium text-pretty text-neutral-900">
                Understand what's going wrong
              </h3>
              <p className="text-base text-neutral-600">
                Interfere goes beyond logs, metrics, and traces. It finds the
                root cause and explains what's broken, why, and who it impacts.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <MiniIllustration>
              <div className="flex h-full w-full flex-col gap-2 overflow-hidden rounded-lg border border-black/6 bg-gradient-to-b from-neutral-50 to-transparent p-4 font-mono text-[10px] leading-relaxed select-none">
                <p className="text-neutral-400">auth/reset.ts</p>
                <div className="rounded-md bg-[#cf222e]/6 px-2 py-1 text-[#cf222e]">
                  - route: "/reset-password"
                </div>
                <div className="rounded-md bg-[#1a7f37]/8 px-2 py-1 text-[#1a7f37]">
                  + route: "/auth/reset"
                </div>
                <div className="mt-auto flex items-center gap-2 font-sans">
                  <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white">
                    Apply fix
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[10px] text-neutral-500 ring-1 ring-black/8">
                    Open PR #482
                  </span>
                </div>
              </div>
            </MiniIllustration>
            <div className="flex flex-col gap-2">
              <h3 className="text-[21px] font-medium text-pretty text-neutral-900">
                Fix problems with confidence
              </h3>
              <p className="text-base text-neutral-600">
                Interfere turns insight into action by suggesting fixes, linking
                them to your codebase, and tracking progress until resolved.
                You're always in control.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Quote() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8">
          <blockquote className="text-center text-[21px] leading-snug font-medium text-balance text-neutral-900 md:text-[28px]">
            "Every hour spent chasing bugs is time away from building features
            that users actually want. Interfere gives your team time to focus on
            what actually matters."
          </blockquote>
          <div className="flex items-center gap-3">
            <InitialsAvatar className="size-9 text-xs" initials="DB" />
            <div className="text-sm">
              <p className="font-medium text-neutral-900">Dylan Babbs</p>
              <p className="text-neutral-500">CTO of Profound</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FeatureBlock({ feature }: { feature: (typeof FEATURES)[number] }) {
  return (
    <section className="overflow-x-clip py-16 md:py-24">
      <Container className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="flex items-center">
          <div className="flex h-full max-w-120 flex-col md:py-12">
            <MonoLabel>{feature.index}</MonoLabel>
            <h2 className="mt-4 text-[28px] leading-tight font-medium text-pretty text-neutral-900">
              {feature.title}
            </h2>
            <p className="mt-4 text-base text-balance text-neutral-600">
              {feature.description}
            </p>
            <p className="mt-10 text-sm font-medium text-neutral-600 md:mt-auto">
              {feature.capabilitiesLabel}
            </p>
            <div className="mt-4">
              <div className="h-px w-full bg-black/8" role="separator" />
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-2">
                {feature.capabilities.map((capability) => (
                  <p className="text-sm text-neutral-600" key={capability}>
                    {capability}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-120 min-w-0 md:h-160">
          <div className="absolute inset-y-0 -right-50 left-0 flex items-center justify-start overflow-hidden">
            <div className="relative flex h-full w-[1200px] shrink-0">
              <div className="relative flex h-full w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/8 select-none">
                {feature.illustration}
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 -right-50 w-40 bg-gradient-to-r from-transparent to-[#fcfcfc]" />
        </div>
      </Container>
    </section>
  );
}

function Security() {
  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-[28px] leading-tight font-medium text-nowrap">
            <span className="block text-neutral-900">Secure by design.</span>
            <span className="block text-neutral-400">Safe by default.</span>
          </h2>
          <a
            className="group flex items-center gap-2 text-base text-neutral-600 transition-colors hover:text-neutral-900"
            href="#"
          >
            Learn more
            <ArrowUpRightGlyph className="size-4" />
          </a>
        </div>
        <div className="mt-12 flex flex-col items-stretch gap-10 lg:flex-row">
          {[
            {
              title: "SOC 2 Type II",
              description:
                "We're in our SOC 2 observation period, with estimated completion in Q3 2026.",
            },
            {
              title: "GDPR & ISO 27001",
              description:
                "We're working on compliance with GDPR and ISO 27001, with additional auditing available upon request.",
            },
          ].map((item) => (
            <div
              className="flex flex-col items-stretch gap-10 lg:flex-row"
              key={item.title}
            >
              <div className="h-px w-full bg-black/8 lg:h-auto lg:w-px" />
              <div className="flex max-w-none flex-1 flex-col gap-8 lg:max-w-68">
                <div className="w-fit rounded-3xl bg-black/5 p-1">
                  <div className="grid size-14 place-items-center rounded-2xl bg-[#fcfcfc] shadow-sm">
                    <ShieldGlyph className="size-7 text-neutral-400" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-base font-medium text-neutral-900">
                    {item.title}
                  </p>
                  <p className="text-base text-neutral-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Latest() {
  return (
    <section className="py-24 md:py-30">
      <Container className="flex flex-col gap-10">
        <h2 className="text-[28px] leading-tight font-medium text-neutral-900">
          The Latest
        </h2>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {CHANGELOG.map((entry) => (
            <a
              className="group relative flex flex-col gap-4 border-t border-black/8 pt-6 pr-6"
              href="#"
              key={entry.title}
            >
              <div className="flex items-start justify-between">
                <MonoLabel>{entry.date}</MonoLabel>
                <ArrowUpRightGlyph className="size-4 text-neutral-300 transition-colors group-hover:text-neutral-900" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="truncate text-base font-medium text-neutral-900">
                  {entry.title}
                </p>
                <p className="line-clamp-3 text-base text-neutral-600">
                  {entry.description}
                </p>
              </div>
            </a>
          ))}
        </div>
        <a
          className="group flex w-fit items-center gap-2 text-base text-neutral-600 transition-colors hover:text-neutral-900"
          href="#"
        >
          See all releases
          <ChevronRightGlyph className="size-4" />
        </a>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="w-full shrink-0 overflow-hidden bg-gradient-to-b from-neutral-100 to-[#fcfcfc]">
      <Container className="relative">
        <div className="absolute top-0 left-1/2 h-px w-screen -translate-x-1/2 bg-black/8" />
        <div className="relative py-16 md:py-40">
          <div
            className="pointer-events-none absolute top-0 left-1/2 h-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
            style={{ backgroundImage: BRAND_GRADIENT }}
          />
          <div className="flex flex-col items-center gap-6 md:gap-12">
            <h2 className="text-center text-4xl leading-none font-medium tracking-[-0.02em] text-neutral-900 md:text-[59px]">
              <span className="block">Ship software that</span>
              <span className="block">
                never <BreaksWord className="tracking-[-0.03em]" />
              </span>
            </h2>
            <div className="flex gap-4">
              <Button className="w-40" href="#" size="xl" variant="secondary">
                Get Early Access
              </Button>
              <Button className="w-40" href="#" size="xl" variant="primary">
                Request a demo
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 py-10 md:flex-row md:justify-between">
          <p className="text-base text-neutral-400 select-none">
            Ask about Interfere on ChatGPT, Claude, or Perplexity
          </p>
          <span className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="size-2 rounded-full bg-[#1a7f37]" />
            All systems operational
          </span>
        </div>

        <div className="h-px w-full bg-black/8" role="separator" />

        <div className="flex flex-col-reverse items-start justify-between gap-16 py-20 md:flex-row md:gap-20">
          <a
            aria-label="Interfere"
            className="text-neutral-900"
            href="/interfere"
          >
            <InterfereLogo />
          </a>
          <div className="grid grid-cols-2 gap-x-16 gap-y-10 md:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div className="flex flex-col gap-3" key={column.title}>
                <p className="text-sm font-medium text-neutral-900">
                  {column.title}
                </p>
                {column.links.map((link) => (
                  <a
                    className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                    href="#"
                    key={link}
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="h-px w-full bg-black/8" role="separator" />

        <div className="flex flex-col items-start gap-2 pt-6 pb-10 text-xs text-neutral-400">
          <p>Copyright © 2026 Interfere, Inc. All rights reserved.</p>
          <p>
            Interfere™, and the Interfere logo are trademarks of Interfere, Inc.
            Trademark applications are pending in the United States and other
            jurisdictions.
          </p>
        </div>
      </Container>
    </footer>
  );
}

function InterferePage() {
  return (
    <div className="flex min-h-full w-full flex-col bg-[#fcfcfc] font-sans text-neutral-900 antialiased">
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HairlineDivider />
        <HowItWorks />
        <Quote />
        <HairlineDivider />
        {FEATURES.map((feature, index) => (
          <div key={feature.index}>
            {index > 0 ? <HairlineDivider /> : null}
            <FeatureBlock feature={feature} />
          </div>
        ))}
        <HairlineDivider />
        <Security />
        <Latest />
      </main>
      <Footer />
    </div>
  );
}
