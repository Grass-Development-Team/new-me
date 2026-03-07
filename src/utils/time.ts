type DateTimePartType = "year" | "month" | "day" | "hour" | "minute" | "second";

function has_explicit_timezone(raw: string): boolean {
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
}

function parse_naive_datetime_as_utc(raw: string): Date | undefined {
  const match =
    raw.match(
      /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
    ) ?? undefined;

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "0");
  const minute = Number(match[5] ?? "0");
  const second = Number(match[6] ?? "0");
  const ms = Number((match[7] ?? "0").padEnd(3, "0"));

  const parsed = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, ms),
  );
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  // Reject overflow values like 2026-02-30.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second
  ) {
    return undefined;
  }

  return parsed;
}

function parse_time(time: string): Date | undefined {
  const raw = time.trim();

  if (!raw) {
    return undefined;
  }

  if (/^\d+$/.test(raw) && (raw.length === 10 || raw.length === 13)) {
    const numeric = Number(raw);
    const ms = raw.length === 10 ? numeric * 1000 : numeric;
    const parsed = new Date(ms);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Treat naive datetime strings as UTC, then convert to target TZ later.
  if (!has_explicit_timezone(raw)) {
    const naive_utc = parse_naive_datetime_as_utc(raw);
    if (naive_utc) {
      return naive_utc;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function format_parts(
  date: Date,
  timezone: string,
): Record<DateTimePartType, string> | undefined {
  let parts: Intl.DateTimeFormatPart[];

  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    return undefined;
  }

  const formatted: Partial<Record<DateTimePartType, string>> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      formatted[part.type] = part.value;
    }
  }

  if (
    !formatted.year ||
    !formatted.month ||
    !formatted.day ||
    !formatted.hour ||
    !formatted.minute ||
    !formatted.second
  ) {
    return undefined;
  }

  return formatted as Record<DateTimePartType, string>;
}

export function format_time_by_tz(
  time: string,
  timezone: string | undefined = process.env.TZ ?? "UTC",
): string {
  const parsed = parse_time(time);
  if (!parsed) {
    return time;
  }

  const parts = format_parts(parsed, timezone);
  if (!parts) {
    return time;
  }

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
