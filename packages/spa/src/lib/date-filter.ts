export const DATE_FILTERS = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
] as const;

export type DateFilter = (typeof DATE_FILTERS)[number]["value"];

export const dateCutoff = (filter: DateFilter): number => {
  const day = 86_400_000;
  switch (filter) {
    case "today": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return start.getTime();
    }
    case "7d":
      return Date.now() - 7 * day;
    case "30d":
      return Date.now() - 30 * day;
    default:
      return 0;
  }
};

export const dateFilterLabel = (value: DateFilter) =>
  DATE_FILTERS.find((d) => d.value === value)?.label ?? "Any time";
