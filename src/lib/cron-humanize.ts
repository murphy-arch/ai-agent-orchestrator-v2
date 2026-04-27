/**
 * Humanize a cron expression into plain English.
 * Supports standard 5-field cron: minute hour day month day-of-week
 */
export function humanizeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Minute
  let timeStr = "";
  if (minute === "0" && hour !== "*") {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    timeStr = `at ${h12}:00 ${ampm}`;
  } else if (minute === "*" && hour === "*") {
    timeStr = "every minute";
  } else if (minute.startsWith("*/")) {
    const interval = minute.replace("*/", "");
    timeStr = `every ${interval} minutes`;
  } else if (hour === "*") {
    timeStr = `at minute ${minute} of every hour`;
  } else {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mStr = m.toString().padStart(2, "0");
    timeStr = `at ${h12}:${mStr} ${ampm}`;
  }

  // Day of week
  const dayNames: Record<string, string> = {
    "0": "Sunday",
    "1": "Monday",
    "2": "Tuesday",
    "3": "Wednesday",
    "4": "Thursday",
    "5": "Friday",
    "6": "Saturday",
    "7": "Sunday",
  };

  let dayStr = "";
  if (dayOfWeek !== "*") {
    if (dayOfWeek.includes("-")) {
      const [start, end] = dayOfWeek.split("-");
      dayStr = ` on ${dayNames[start] ?? start} through ${dayNames[end] ?? end}`;
    } else if (dayOfWeek.includes(",")) {
      const days = dayOfWeek.split(",").map((d) => dayNames[d] ?? d);
      dayStr = ` on ${days.join(", ")}`;
    } else {
      dayStr = ` on ${dayNames[dayOfWeek] ?? dayOfWeek}`;
    }
  }

  // Day of month
  if (dayOfMonth !== "*" && dayOfWeek === "*") {
    if (dayOfMonth === "1") {
      dayStr = " on the 1st of every month";
    } else {
      dayStr = ` on day ${dayOfMonth} of every month`;
    }
  }

  // Month
  if (month !== "*") {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      dayStr += ` in ${monthNames[mIdx]}`;
    }
  }

  return `${timeStr}${dayStr}`;
}

/**
 * Parse a cron expression into its 5 labeled fields.
 */
export function parseCronFields(cron: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const parts = cron.trim().split(/\s+/);
  return {
    minute: parts[0] ?? "",
    hour: parts[1] ?? "",
    dayOfMonth: parts[2] ?? "",
    month: parts[3] ?? "",
    dayOfWeek: parts[4] ?? "",
  };
}

export const CRON_FIELD_LABELS = [
  { label: "Minute", range: "0–59", example: "0" },
  { label: "Hour", range: "0–23", example: "9" },
  { label: "Day of Month", range: "1–31", example: "*" },
  { label: "Month", range: "1–12", example: "*" },
  { label: "Day of Week", range: "0–6 (Sun=0)", example: "1" },
];

export const CRON_COMMON_PATTERNS = [
  { pattern: "* * * * *", meaning: "Every minute" },
  { pattern: "0 * * * *", meaning: "Every hour" },
  { pattern: "0 9 * * *", meaning: "Daily at 9:00 AM" },
  { pattern: "0 9 * * 1", meaning: "Every Monday at 9:00 AM" },
  { pattern: "0 9 * * 1-5", meaning: "Every weekday at 9:00 AM" },
  { pattern: "0 0 * * 0", meaning: "Every Sunday at midnight" },
  { pattern: "0 9 1 * *", meaning: "1st of every month at 9:00 AM" },
];
