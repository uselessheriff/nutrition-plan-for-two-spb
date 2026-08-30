import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/plan-calendar.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const calendar = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const instant = (value) => new Date(value);

test("maps Moscow Monday-to-Sunday boundaries to the four explicit plan weeks", () => {
  const cases = [
    ["2026-08-09T20:59:59.999Z", "before_plan", null],
    ["2026-08-09T21:00:00.000Z", "in_plan", 1],
    ["2026-08-16T20:59:59.999Z", "in_plan", 1],
    ["2026-08-16T21:00:00.000Z", "in_plan", 2],
    ["2026-08-23T20:59:59.999Z", "in_plan", 2],
    ["2026-08-23T21:00:00.000Z", "in_plan", 3],
    ["2026-08-30T20:59:59.999Z", "in_plan", 3],
    ["2026-08-30T21:00:00.000Z", "in_plan", 4],
    ["2026-09-06T20:59:59.999Z", "in_plan", 4],
    ["2026-09-06T21:00:00.000Z", "after_plan", null],
  ];

  for (const [at, phase, activePlanWeek] of cases) {
    const result = calendar.getPlanCalendar(instant(at));
    assert.equal(result.phase, phase, at);
    assert.equal(result.activePlanWeek, activePlanWeek, at);
    assert.equal(result.weeks.filter((week) => week.temporalStatus === "current").length, activePlanWeek === null ? 0 : 1, at);
  }
});

test("keeps temporal statuses separate from the menu archive and purchase state", () => {
  const sunday = calendar.getPlanCalendar(instant("2026-08-30T12:00:00.000Z"));
  assert.equal(sunday.moscowDateKey, "2026-08-30");
  assert.equal(sunday.activePlanWeek, 3);
  assert.deepEqual(sunday.weeks.map((week) => week.temporalStatus), ["past", "past", "current", "future"]);

  const monday = calendar.getPlanCalendar(instant("2026-08-30T21:00:00.000Z"));
  assert.equal(monday.moscowDateKey, "2026-08-31");
  assert.equal(monday.activePlanWeek, 4);
  assert.deepEqual(monday.weeks.map((week) => week.temporalStatus), ["past", "past", "past", "current"]);
});

test("formats Russian Moscow date and time and reports the ISO week", () => {
  const at = instant("2026-08-30T09:34:56.789Z");
  const result = calendar.getPlanCalendar(at);

  assert.match(result.russianDate, /воскресенье.*30 августа.*2026/iu);
  assert.equal(result.moscowTime, "12:34");
  assert.equal(result.isoWeekYear, 2026);
  assert.equal(result.isoWeekNumber, 35);
  assert.equal(calendar.formatPlanWeekRange(calendar.PLAN_WEEK_RANGES[0]), "10–16 августа 2026");
  assert.equal(calendar.formatPlanWeekRange(calendar.PLAN_WEEK_RANGES[3]), "31 августа – 6 сентября 2026");
});

test("handles ISO week-year boundaries using the Moscow civil date", () => {
  assert.deepEqual(
    calendar.getIsoWeekForMoscowDate(instant("2021-01-01T12:00:00.000Z")),
    { isoWeekYear: 2020, isoWeekNumber: 53 },
  );
  assert.deepEqual(
    calendar.getIsoWeekForMoscowDate(instant("2021-01-03T21:00:00.000Z")),
    { isoWeekYear: 2021, isoWeekNumber: 1 },
  );
});

test("validates explicit, contiguous Monday-to-Sunday ranges", () => {
  assert.doesNotThrow(() => calendar.validatePlanWeekRanges(calendar.PLAN_WEEK_RANGES));
  assert.throws(() => calendar.validatePlanWeekRanges([]), /не может быть пустым/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    calendar.PLAN_WEEK_RANGES[0],
    calendar.PLAN_WEEK_RANGES[0],
  ]), /указана дважды/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    { number: 1, start: "2026-8-10", end: "2026-08-16", basis: "repo_history_and_user_reports" },
  ]), /Некорректная/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    { number: 1, start: "2026-02-30", end: "2026-03-08", basis: "repo_history_and_user_reports" },
  ]), /Несуществующая/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    { number: 1, start: "2026-08-11", end: "2026-08-17", basis: "repo_history_and_user_reports" },
  ]), /с понедельника по воскресенье/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    { number: 1, start: "2026-08-10", end: "2026-08-23", basis: "repo_history_and_user_reports" },
  ]), /семь календарных дней/iu);
  assert.throws(() => calendar.validatePlanWeekRanges([
    calendar.PLAN_WEEK_RANGES[0],
    { number: 2, start: "2026-08-24", end: "2026-08-30", basis: "repo_history_and_user_reports" },
  ]), /без пропусков и пересечений/iu);
});

test("calculates the refresh delay to the next Moscow midnight", () => {
  assert.equal(calendar.millisecondsUntilNextMoscowMidnight(instant("2026-08-30T20:59:59.900Z")), 100);
  assert.equal(calendar.millisecondsUntilNextMoscowMidnight(instant("2026-08-30T21:00:00.000Z")), 86_400_000);
  assert.equal(calendar.millisecondsUntilNextMoscowMidnight(instant("2026-08-30T09:34:56.789Z")), 41_103_211);
  assert.throws(
    () => calendar.millisecondsUntilNextMoscowMidnight(new Date(Number.NaN)),
    /корректная дата/iu,
  );
});

test("fetchNetworkNow performs a no-store HEAD request and reads the Date header", async () => {
  let requestUrl;
  let requestInit;
  const fakeFetch = async (url, init) => {
    requestUrl = url;
    requestInit = init;
    return new Response(null, {
      status: 200,
      headers: { date: "Sun, 30 Aug 2026 12:34:56 GMT" },
    });
  };

  const onlineNow = await calendar.fetchNetworkNow(
    fakeFetch,
    "https://uselessheriff.github.io/nutrition-plan-for-two-spb/?v=test",
    98372,
  );

  assert.equal(onlineNow.toISOString(), "2026-08-30T12:34:56.000Z");
  assert.equal(requestUrl.searchParams.get("v"), "test");
  assert.equal(requestUrl.searchParams.get("__moscow_clock"), "98372");
  assert.deepEqual(requestInit, { method: "HEAD", cache: "no-store" });
});

test("fetchNetworkNow rejects failed, missing, and invalid network dates", async () => {
  await assert.rejects(
    calendar.fetchNetworkNow(async () => new Response(null, { status: 503 }), "https://example.test/", 1),
    /HTTP 503/,
  );
  await assert.rejects(
    calendar.fetchNetworkNow(async () => new Response(null, { status: 200 }), "https://example.test/", 2),
    /не вернул.*Date/iu,
  );
  await assert.rejects(
    calendar.fetchNetworkNow(
      async () => new Response(null, { status: 200, headers: { date: "not-a-date" } }),
      "https://example.test/",
      3,
    ),
    /корректная дата/iu,
  );
});
