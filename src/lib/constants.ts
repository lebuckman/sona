import type { TimeRange } from "@/types";

export const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "4 Weeks", value: "short_term" },
  { label: "6 Months", value: "medium_term" },
  { label: "All Time", value: "long_term" },
];
