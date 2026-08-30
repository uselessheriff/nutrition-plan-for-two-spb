export const MOSCOW_TIME_ZONE = "Europe/Moscow" as const;

export type PlanWeekNumber = 1 | 2 | 3 | 4;
export type PlanPhase = "before_plan" | "in_plan" | "after_plan";
export type PlanWeekTemporalStatus = "past" | "current" | "future";
export type ClockSource = "network" | "device";

export type PlanWeekRange = Readonly<{
  number: PlanWeekNumber;
  start: string;
  end: string;
  basis: "repo_history_and_user_reports";
}>;

export type PlanCalendarSnapshot = Readonly<{
  moscowDateKey: string;
  russianDate: string;
  moscowTime: string;
  isoWeekYear: number;
  isoWeekNumber: number;
  phase: PlanPhase;
  activePlanWeek: PlanWeekNumber | null;
  weeks: readonly (PlanWeekRange & { temporalStatus: PlanWeekTemporalStatus })[];
}>;

export const PLAN_WEEK_RANGES: readonly PlanWeekRange[] = [
  { number: 1, start: "2026-08-10", end: "2026-08-16", basis: "repo_history_and_user_reports" },
  { number: 2, start: "2026-08-17", end: "2026-08-23", basis: "repo_history_and_user_reports" },
  { number: 3, start: "2026-08-24", end: "2026-08-30", basis: "repo_history_and_user_reports" },
  { number: 4, start: "2026-08-31", end: "2026-09-06", basis: "repo_history_and_user_reports" },
];

const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const moscowDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const moscowTimePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MOSCOW_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const russianDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MOSCOW_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const moscowTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: MOSCOW_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const rangeDayMonthFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
});

function assertValidInstant(at: Date) {
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
    throw new TypeError("Нужна корректная дата и время.");
  }
}

function parseIsoDate(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) throw new TypeError(`Некорректная календарная дата: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError(`Несуществующая календарная дата: ${value}`);
  }
  return { year, month, day, date };
}

function dateParts(at: Date) {
  assertValidInstant(at);
  const values = Object.fromEntries(
    moscowDatePartsFormatter.formatToParts(at)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return { year, month, day, key: `${values.year}-${values.month}-${values.day}` };
}

function timeParts(at: Date) {
  assertValidInstant(at);
  const values = Object.fromEntries(
    moscowTimePartsFormatter.formatToParts(at)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return { hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function isoDateFromUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function validatePlanWeekRanges(ranges: readonly PlanWeekRange[]) {
  if (ranges.length === 0) throw new TypeError("Календарь плана не может быть пустым.");
  const numbers = new Set<number>();
  let previousEnd: Date | null = null;

  for (const range of ranges) {
    if (numbers.has(range.number)) throw new TypeError(`Неделя ${range.number} указана дважды.`);
    numbers.add(range.number);
    const start = parseIsoDate(range.start).date;
    const end = parseIsoDate(range.end).date;
    if (start.getUTCDay() !== 1 || end.getUTCDay() !== 0) {
      throw new TypeError(`Неделя ${range.number} должна идти с понедельника по воскресенье.`);
    }
    if ((end.getTime() - start.getTime()) / DAY_MS !== 6) {
      throw new TypeError(`Неделя ${range.number} должна содержать семь календарных дней.`);
    }
    if (previousEnd && start.getTime() - previousEnd.getTime() !== DAY_MS) {
      throw new TypeError("Недели плана должны идти подряд без пропусков и пересечений.");
    }
    previousEnd = end;
  }
}

validatePlanWeekRanges(PLAN_WEEK_RANGES);

export function getMoscowDateKey(at: Date) {
  return dateParts(at).key;
}

export function getIsoWeekForMoscowDate(at: Date) {
  const { year, month, day } = dateParts(at);
  const thursday = new Date(Date.UTC(year, month - 1, day));
  const weekday = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const isoWeekYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoWeekYear, 0, 1));
  const isoWeekNumber = Math.ceil((((thursday.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return { isoWeekYear, isoWeekNumber };
}

export function formatRussianMoscowDate(at: Date) {
  assertValidInstant(at);
  return russianDateFormatter.format(at);
}

export function formatMoscowTime(at: Date) {
  assertValidInstant(at);
  return moscowTimeFormatter.format(at);
}

export function formatPlanWeekRange(range: PlanWeekRange) {
  const start = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);
  const startDayMonth = rangeDayMonthFormatter.format(start.date);
  const endDayMonth = rangeDayMonthFormatter.format(end.date);
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${endDayMonth} ${end.year}`;
  }
  if (start.year === end.year) {
    return `${startDayMonth} – ${endDayMonth} ${end.year}`;
  }
  return `${startDayMonth} ${start.year} – ${endDayMonth} ${end.year}`;
}

export function getPlanCalendar(at: Date, ranges: readonly PlanWeekRange[] = PLAN_WEEK_RANGES): PlanCalendarSnapshot {
  validatePlanWeekRanges(ranges);
  const moscowDateKey = getMoscowDateKey(at);
  const active = ranges.find((range) => moscowDateKey >= range.start && moscowDateKey <= range.end) ?? null;
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  const phase: PlanPhase = moscowDateKey < first.start ? "before_plan" : moscowDateKey > last.end ? "after_plan" : "in_plan";
  const { isoWeekYear, isoWeekNumber } = getIsoWeekForMoscowDate(at);

  return {
    moscowDateKey,
    russianDate: formatRussianMoscowDate(at),
    moscowTime: formatMoscowTime(at),
    isoWeekYear,
    isoWeekNumber,
    phase,
    activePlanWeek: active?.number ?? null,
    weeks: ranges.map((range) => ({
      ...range,
      temporalStatus: moscowDateKey < range.start ? "future" : moscowDateKey > range.end ? "past" : "current",
    })),
  };
}

export function millisecondsUntilNextMoscowMidnight(at: Date) {
  const { hour, minute, second } = timeParts(at);
  const elapsed = (((hour * 60) + minute) * 60 + second) * 1_000 + at.getUTCMilliseconds();
  return DAY_MS - elapsed;
}

export async function fetchNetworkNow(
  fetcher: typeof fetch,
  pageUrl: string,
  cacheBuster = Date.now(),
) {
  const probeUrl = new URL(pageUrl);
  probeUrl.searchParams.set("__moscow_clock", String(cacheBuster));
  const response = await fetcher(probeUrl, { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось сверить дату онлайн: HTTP ${response.status}.`);
  const header = response.headers.get("date");
  if (!header) throw new Error("Сервер не вернул заголовок Date.");
  const onlineNow = new Date(header);
  assertValidInstant(onlineNow);
  return onlineNow;
}

export function addUtcDays(isoDate: string, days: number) {
  const parsed = parseIsoDate(isoDate).date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return isoDateFromUtc(parsed);
}
