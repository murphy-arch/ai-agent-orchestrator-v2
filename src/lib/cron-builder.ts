export type Frequency = "daily" | "weekly" | "monthly";

export interface CronSelection {
  hour12: number; // 1-12
  minute: number; // 0, 15, 30, 45
  ampm: "am" | "pm";
  frequency: Frequency;
  weeklyDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  monthlyDays: number[]; // 1-31
}

export const HOUR12_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

export const MINUTE_OPTIONS = [0, 15, 30, 45].map((m) => ({
  value: m,
  label: m.toString().padStart(2, "0"),
}));

export const AMPM_OPTIONS = [
  { value: "am" as const, label: "AM" },
  { value: "pm" as const, label: "PM" },
];

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export const MONTHLY_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinal(i + 1)}`,
}));

function getOrdinal(n: number): string {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function to24Hour(hour12: number, ampm: "am" | "pm"): number {
  if (ampm === "am") {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

function from24Hour(hour24: number): { hour12: number; ampm: "am" | "pm" } {
  if (hour24 === 0) return { hour12: 12, ampm: "am" };
  if (hour24 < 12) return { hour12: hour24, ampm: "am" };
  if (hour24 === 12) return { hour12: 12, ampm: "pm" };
  return { hour12: hour24 - 12, ampm: "pm" };
}

/**
 * Build a cron expression from user-friendly selections.
 */
export function buildCronExpression(sel: CronSelection): string {
  const hour24 = to24Hour(sel.hour12, sel.ampm);
  const minute = sel.minute.toString();
  const hour = hour24.toString();

  if (sel.frequency === "daily") {
    return `${minute} ${hour} * * *`;
  }

  if (sel.frequency === "weekly") {
    const days = sel.weeklyDays.length > 0
      ? [...sel.weeklyDays].sort((a, b) => a - b).join(",")
      : "*";
    return `${minute} ${hour} * * ${days}`;
  }

  if (sel.frequency === "monthly") {
    const days = sel.monthlyDays.length > 0
      ? [...sel.monthlyDays].sort((a, b) => a - b).join(",")
      : "1";
    return `${minute} ${hour} ${days} * *`;
  }

  return `${minute} ${hour} * * *`;
}

/**
 * Parse a cron expression back into user-friendly selections.
 * Returns null if the expression can't be parsed by this simple builder.
 */
export function parseCronExpression(cron: string): CronSelection | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minStr, hourStr, dayOfMonth, month, dayOfWeek] = parts;

  const hour24 = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  if (isNaN(hour24) || isNaN(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  const { hour12, ampm } = from24Hour(hour24);

  // Daily: * * * * (any day, any month, any weekday)
  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { hour12, minute, ampm, frequency: "daily", weeklyDays: [], monthlyDays: [] };
  }

  // Weekly: specific day(s) of week, no specific day of month
  if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days = dayOfWeek.split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
    return { hour12, minute, ampm, frequency: "weekly", weeklyDays: days, monthlyDays: [] };
  }

  // Monthly: specific day(s) of month, no specific weekday
  if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
    const days = dayOfMonth.split(",").map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
    return { hour12, minute, ampm, frequency: "monthly", weeklyDays: [], monthlyDays: days };
  }

  return null;
}

/**
 * Human-friendly description of a CronSelection.
 */
export function describeCronSelection(sel: CronSelection): string {
  const minuteLabel = MINUTE_OPTIONS.find((m) => m.value === sel.minute)?.label ?? `${sel.minute}`;
  const time = `${sel.hour12}:${minuteLabel} ${sel.ampm.toUpperCase()}`;

  if (sel.frequency === "daily") {
    return `Daily at ${time}`;
  }

  if (sel.frequency === "weekly") {
    if (sel.weeklyDays.length === 0) return `Weekly at ${time} (no day selected)`;
    const dayLabels = WEEKDAY_OPTIONS
      .filter((d) => sel.weeklyDays.includes(d.value))
      .map((d) => d.short);
    return `${dayLabels.join(", ")} at ${time}`;
  }

  if (sel.frequency === "monthly") {
    if (sel.monthlyDays.length === 0) return `Monthly at ${time} (no day selected)`;
    const dayLabels = sel.monthlyDays.map((d) => `${d}${getOrdinal(d)}`);
    return `${dayLabels.join(", ")} of each month at ${time}`;
  }

  return `At ${time}`;
}
