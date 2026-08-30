import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const history = await importTypeScript("../app/meal-history.ts");

test("records only the explicitly confirmed cooking outcomes", () => {
  const pizza = history.getMealHistoryByMenuKey("1:Пицца с курицей, грибами и томатами");
  const pancakes = history.getMealHistoryByMenuKey("1:Творожно-овсяные панкейки");
  const panga = history.getMealHistoryByMenuKey("3:Пангасиус с картофелем, фасолью и лимонным соусом");

  assert.equal(pizza.outcome, "cooked");
  assert.equal(pizza.preference, "favorite");
  assert.equal(pancakes.outcome, "cooked");
  assert.equal(pancakes.preference, null);
  assert.equal(panga.outcome, "cooked");
  assert.equal(panga.preference, "blocked");
});

test("does not infer that every current third-week dish was cooked", () => {
  const currentWeekThree = history.mealHistoryEntries.filter(
    (entry) => entry.week === 3 && entry.origin === "current_menu",
  );

  assert.equal(currentWeekThree.length, 7);
  assert.equal(currentWeekThree.filter((entry) => entry.outcome === "cooked").length, 1);
  assert.equal(currentWeekThree.filter((entry) => entry.outcome === "unconfirmed").length, 6);
  assert.equal(
    history.getMealHistoryByMenuKey("3:Сырники с ягодами и йогуртом").outcome,
    "unconfirmed",
  );
  assert.equal(
    history.getMealHistoryByMenuKey("3:Сырники с ягодами и йогуртом").preference,
    "liked",
  );
});

test("keeps every current second-week dish unconfirmed", () => {
  const currentWeekTwo = history.mealHistoryEntries.filter(
    (entry) => entry.week === 2 && entry.origin === "current_menu",
  );

  assert.equal(currentWeekTwo.length, 11);
  assert.ok(currentWeekTwo.every((entry) => entry.outcome === "unconfirmed"));
  assert.ok(currentWeekTwo.every((entry) => entry.preference === null));
});

test("preserves removed third-week meals as history-only entries", () => {
  const removed = history.historyOnlyMealEntries;
  const beefCutlets = removed.find((entry) => entry.id === "history:3:thursday-beef-cutlets");
  const planned = removed.filter((entry) => entry.outcome === "planned_to_skip");

  assert.equal(removed.length, 4);
  assert.equal(beefCutlets.outcome, "not_eaten");
  assert.equal(beefCutlets.menuKey, null);
  assert.equal(planned.length, 3);
  assert.deepEqual(
    planned.map((entry) => entry.title),
    [
      "Греческий салат с курицей и питой",
      "Картофельная запеканка с индейкой и овощами",
      "Остаток запеканки и свежий салат",
    ],
  );
  assert.ok(planned.every((entry) => !history.isConfirmedNotEaten(entry)));
});

test("counts planned skips separately from confirmed meals not eaten", () => {
  const summary = history.weekMealHistorySummaries[3];

  assert.equal(summary.currentMenuCount, 7);
  assert.equal(summary.historyOnlyCount, 4);
  assert.equal(summary.outcomes.cooked, 1);
  assert.equal(summary.outcomes.not_eaten, 1);
  assert.equal(summary.outcomes.planned_to_skip, 3);
  assert.equal(summary.outcomes.unconfirmed, 6);
  assert.equal(summary.preferences.liked, 1);
  assert.equal(summary.preferences.blocked, 1);
});

test("provides a unique lookup for every current menu key", () => {
  const current = history.mealHistoryEntries.filter((entry) => entry.origin === "current_menu");
  const keys = current.map((entry) => entry.menuKey);

  assert.equal(keys.length, 29);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(Object.keys(history.mealHistoryByMenuKey).length, keys.length);
  assert.equal(history.getMealHistoryByMenuKey("3:Греческий салат с курицей и питой"), undefined);
});

test("keeps recipe edits and future plans separate from confirmed cooking", () => {
  assert.match(history.weekMealHistoryNotes[1].join(" "), /Лисички.*заменены/);
  assert.match(history.weekMealHistoryNotes[2].join(" "), /Белокочанную капусту удалили/);
  assert.match(history.weekMealHistoryNotes[3].join(" "), /Сырники и куриный чили были планом/);
});
