import type { ReactNode } from "react";

import {
  CheckGlyph,
  ChevronRightGlyph,
  FileGlyph,
  InboxGlyph,
  InitialsAvatar,
  PulseGlyph,
  StarsGlyph,
  UserGlyph,
  WarningGlyph,
} from "#/components/interfere/ui";

const PROPERTIES: ReadonlyArray<{ label: string; value: ReactNode }> = [
  { label: "Title", value: "Broken password reset link" },
  {
    label: "Priority",
    value: (
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[#ff3b00]" />
        High
      </span>
    ),
  },
  {
    label: "Assignee",
    value: (
      <span className="flex items-center gap-1.5">
        <InitialsAvatar initials="LS" />
        Luke Shiels
      </span>
    ),
  },
  {
    label: "Status",
    value: (
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[#008eff]" />
        Active
      </span>
    ),
  },
  {
    label: "Surface",
    value: (
      <span className="flex flex-wrap gap-1">
        <span className="rounded-full bg-black/5 px-1.5 py-0.5">
          Website Frontend
        </span>
        <span className="rounded-full bg-black/5 px-1.5 py-0.5">iOS App</span>
      </span>
    ),
  },
  { label: "Regression", value: "Yes" },
  { label: "First detection", value: "36 minutes ago" },
  { label: "Latest detection", value: "Just now" },
  { label: "Duration", value: "36 min 47 s" },
  { label: "Findings", value: "146 findings" },
  { label: "Impacted Users", value: "12,881" },
];

const TIMELINE: ReadonlyArray<{
  icon?: ReactNode;
  title: string;
  time: string;
  body?: string;
  chip?: string;
}> = [
  {
    icon: <WarningGlyph className="size-3.5 text-[#ff3b00]" />,
    title: "Problem detected",
    time: "4 min ago",
    body: "Interfere detected a surge in failed password reset attempts. Users are clicking reset links but failing to complete the flow.",
  },
  { title: "Status updated to Investigating", time: "4 min ago" },
  {
    icon: <StarsGlyph className="size-3.5 text-[#973ec6]" />,
    title: "Finding",
    time: "3 min ago",
    body: "A recent change in auth/reset.ts may cause invalid token validation.",
    chip: "auth/reset.ts",
  },
  {
    icon: <PulseGlyph className="size-3.5 text-[#008eff]" />,
    title: "Fact",
    time: "3 min ago",
    body: "Error rate increased from 0.2% to 12% within 6 minutes after deployment.",
  },
  { title: "Assigned to Luke Shiels", time: "3 min ago" },
  { title: "Priority set to High", time: "3 min ago" },
  { title: "Status updated to Active", time: "3 min ago" },
];

const INBOX_COLUMNS: ReadonlyArray<{
  title: string;
  cards: ReadonlyArray<{
    id: string;
    title: string;
    priority: "High" | "Medium" | "Low";
    users: string;
    reasoning?: boolean;
  }>;
}> = [
  {
    title: "Under Investigation",
    cards: [
      {
        id: "#87",
        title: "Users unable to export billing invoices",
        priority: "High",
        users: "1,521",
        reasoning: true,
      },
      {
        id: "#65",
        title: "Payments failing for users in Brazil",
        priority: "Low",
        users: "340",
        reasoning: true,
      },
    ],
  },
  {
    title: "Active",
    cards: [
      {
        id: "#120",
        title: "Broken password reset link",
        priority: "High",
        users: "2,122",
      },
      {
        id: "#108",
        title: "Onboarding emails not being delivered",
        priority: "Medium",
        users: "870",
      },
      {
        id: "#95",
        title: "Search results showing wrong products",
        priority: "Low",
        users: "109",
      },
    ],
  },
  {
    title: "In Recovery",
    cards: [
      {
        id: "#74",
        title: "Team invite links expiring too soon",
        priority: "Medium",
        users: "1,120",
      },
      {
        id: "#61",
        title: "Dashboard charts blank for new accounts",
        priority: "Low",
        users: "891",
      },
    ],
  },
];

const PRIORITY_TONE = {
  High: "text-[#ff3b00]",
  Medium: "text-[#b8860b]",
  Low: "text-neutral-400",
} as const;

function IconRail() {
  return (
    <div className="flex h-full shrink-0 flex-col items-center gap-3 p-3">
      <div className="grid size-5 shrink-0 place-items-center rounded-sm bg-neutral-900">
        <svg
          aria-hidden="true"
          className="size-3 text-white"
          fill="currentColor"
          viewBox="0 0 18 18"
        >
          <rect height="4" width="4" x="0" y="7" />
          <rect height="4" width="4" x="7" y="0" />
          <rect height="4" width="4" x="7" y="14" />
          <rect height="4" width="4" x="14" y="7" />
        </svg>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="grid size-7 place-items-center rounded-md bg-white shadow-sm ring-1 ring-black/5">
          <InboxGlyph className="size-4 text-neutral-500" />
        </span>
        <span className="grid size-7 place-items-center rounded-md">
          <PulseGlyph className="size-4 text-neutral-400" />
        </span>
        <span className="grid size-7 place-items-center rounded-md">
          <UserGlyph className="size-4 text-neutral-400" />
        </span>
        <span className="grid size-7 place-items-center rounded-md">
          <FileGlyph className="size-4 text-neutral-400" />
        </span>
      </div>
      <div className="h-px w-4 bg-neutral-300" />
      <div className="flex flex-col items-center gap-1">
        <span className="grid size-5 place-items-center rounded-sm bg-[#1a7f37]/10 text-[9px] font-semibold text-[#1a7f37]">
          W
        </span>
        <span className="grid size-5 place-items-center rounded-sm bg-[#b8860b]/10 text-[9px] font-semibold text-[#b8860b]">
          iOS
        </span>
        <span className="grid size-5 place-items-center rounded-sm bg-[#973ec6]/10 text-[9px] font-semibold text-[#973ec6]">
          API
        </span>
      </div>
    </div>
  );
}

function WindowHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-black/8 px-3">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {children}
      </div>
      <div className="flex items-center -space-x-1.5">
        {["LS", "DB", "MK"].map((initials) => (
          <span className="rounded-full bg-white p-0.5" key={initials}>
            <InitialsAvatar className="size-6 text-[9px]" initials={initials} />
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: (typeof TIMELINE)[number] }) {
  if (!entry.body) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-xs text-neutral-500">
        <span className="grid size-5 shrink-0 place-items-center">
          <span className="size-1.5 rounded-full bg-neutral-300" />
        </span>
        <span>{entry.title}</span>
        <span className="text-neutral-300">·</span>
        <span className="text-neutral-400">{entry.time}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2 py-1.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-black/4">
        {entry.icon}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium text-neutral-800">
          {entry.title}
          <span className="font-normal text-neutral-300">·</span>
          <span className="font-normal text-neutral-400">{entry.time}</span>
        </p>
        <p className="mt-1 max-w-100 text-xs leading-relaxed text-neutral-600">
          {entry.body}
        </p>
        {entry.chip ? (
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-black/4 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
            <FileGlyph className="size-3" />
            {entry.chip}
            <span className="text-neutral-400">Open</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function IssueActivity({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 pt-3">
      {compact ? null : (
        <>
          <p className="font-mono text-[10px] text-neutral-400">#120</p>
          <h3 className="mt-1 text-[15px] font-medium text-neutral-900">
            Broken password reset link
          </h3>
          <p className="mt-1 max-w-105 text-xs leading-relaxed text-neutral-500">
            Users are unable to complete password resets after clicking reset
            links generated in production.
          </p>
        </>
      )}
      <div className="mt-3 flex items-center gap-4 border-b border-black/8 pb-2 text-xs">
        <span className="font-medium text-neutral-900">Activity</span>
        <span className="text-neutral-400">Sessions</span>
        <span className="text-neutral-400">Findings</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pt-1.5">
        {TIMELINE.map((entry) => (
          <TimelineEntry entry={entry} key={entry.title + entry.time} />
        ))}
        <div className="mt-1 max-w-100 rounded-lg bg-black/4 p-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <InitialsAvatar initials="DB" />
            <span className="font-medium text-neutral-800">Dylan</span>
            <span className="text-neutral-400">just now</span>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Looks related to yesterday's auth refactor.
          </p>
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel() {
  return (
    <div className="hidden w-56 shrink-0 flex-col gap-2.5 overflow-hidden border-l border-black/8 px-3.5 pt-3.5 text-xs md:flex">
      {PROPERTIES.map((property) => (
        <div className="flex items-start gap-2" key={property.label}>
          <span className="w-20 shrink-0 pt-px text-neutral-400">
            {property.label}
          </span>
          <span className="min-w-0 text-neutral-800">{property.value}</span>
        </div>
      ))}
    </div>
  );
}

export function IssueDetailApp({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex h-full w-full">
      <IconRail />
      <div className="flex h-full min-w-0 flex-1 p-1 pl-0">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/6">
          <WindowHeader>
            <InboxGlyph className="size-3.5 text-neutral-400" />
            <span className="font-medium text-neutral-500">Inbox</span>
            <ChevronRightGlyph className="size-3 text-neutral-300" />
            <span className="truncate font-medium text-neutral-900">
              Broken password reset link
            </span>
          </WindowHeader>
          <div className="flex min-h-0 flex-1">
            <IssueActivity compact={compact} />
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxApp() {
  return (
    <div className="flex h-full w-full">
      <IconRail />
      <div className="flex h-full min-w-0 flex-1 p-1 pl-0">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/6">
          <WindowHeader>
            <InboxGlyph className="size-3.5 text-neutral-400" />
            <span className="font-medium text-neutral-900">Inbox</span>
          </WindowHeader>
          <div className="flex min-h-0 flex-1 gap-2 overflow-hidden px-2 pt-2">
            {INBOX_COLUMNS.map((column) => (
              <div
                className="flex w-72 shrink-0 flex-col gap-1 rounded-lg bg-neutral-50 p-1 ring-1 ring-black/5"
                key={column.title}
              >
                <div className="flex h-7 items-center gap-1.5 px-1">
                  <p className="flex-1 text-center font-mono text-[10px] tracking-wide text-neutral-400 uppercase">
                    {column.title}
                  </p>
                  <span className="grid size-4 place-items-center rounded-sm bg-black/5 text-[10px] text-neutral-500">
                    {column.cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 px-1">
                  {column.cards.map((card) => (
                    <div
                      className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/6"
                      key={card.id}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grow font-mono text-[10px] text-neutral-400">
                          {card.id}
                        </span>
                        <InitialsAvatar initials="LS" />
                      </div>
                      <p className="mt-1 text-xs font-medium text-neutral-800">
                        {card.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px]">
                        <span
                          className={`flex items-center gap-1 ${PRIORITY_TONE[card.priority]}`}
                        >
                          <span className="size-1 rounded-full bg-current" />
                          {card.priority}
                        </span>
                        <span className="text-neutral-400">
                          {card.users} users
                        </span>
                        {card.reasoning ? (
                          <span className="ml-auto flex items-center gap-1 rounded-full bg-[#973ec6]/8 px-1.5 py-0.5 text-[#973ec6]">
                            <StarsGlyph className="size-2.5" />
                            Reasoning
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FixApp() {
  return (
    <div className="flex h-full w-full">
      <IconRail />
      <div className="flex h-full min-w-0 flex-1 p-1 pl-0">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/6">
          <WindowHeader>
            <InboxGlyph className="size-3.5 text-neutral-400" />
            <span className="font-medium text-neutral-500">Inbox</span>
            <ChevronRightGlyph className="size-3 text-neutral-300" />
            <span className="truncate font-medium text-neutral-900">#120</span>
          </WindowHeader>
          <div className="flex min-h-0 flex-1">
            <IssueActivity compact />
            <div className="hidden w-64 shrink-0 flex-col gap-2 overflow-hidden border-l border-black/8 p-3 md:flex">
              <p className="text-xs font-medium text-neutral-800">
                Suggested fix
              </p>
              <div className="rounded-lg bg-neutral-50 p-2 font-mono text-[10px] leading-relaxed ring-1 ring-black/6">
                <p className="text-neutral-400">auth/reset.ts</p>
                <p className="mt-1 text-[#cf222e]">
                  - route: "/reset-password"
                </p>
                <p className="text-[#1a7f37]">+ route: "/auth/reset"</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                <CheckGlyph className="size-3 text-[#1a7f37]" />
                Linked to PR #482 · CI passing
              </div>
              <div className="mt-auto mb-2 flex gap-1.5">
                <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white">
                  Apply fix
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] text-neutral-500 ring-1 ring-black/8">
                  Dismiss
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none relative flex overflow-hidden rounded-2xl bg-[#ebebeb]/70 ring-1 ring-black/8 backdrop-blur-[20px] select-none ${className}`}
      style={{
        boxShadow:
          "0 149px 199px 0 rgba(0,0,0,0.07), 0 62px 83px 0 rgba(0,0,0,0.05), 0 33px 44px 0 rgba(0,0,0,0.04), 0 19px 25px 0 rgba(0,0,0,0.04), 0 10px 13px 0 rgba(0,0,0,0.03), 0 4px 6px 0 rgba(0,0,0,0.02)",
      }}
    >
      {children}
    </div>
  );
}
