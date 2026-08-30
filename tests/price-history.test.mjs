import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/price-history.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const prices = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const observation = (overrides = {}) => ({
  id: "milk-1",
  productKey: "milk",
  productName: "Молоко",
  comparability: "exact",
  date: "2026-08-01",
  source: "Лента",
  packageQuantity: 1,
  packageUnit: "l",
  totalPrice: 100,
  ...overrides,
});

test("normalizes grams and kilograms to roubles per kilogram", () => {
  const [row] = prices.analyzePriceHistory([
    observation({ id: "apples-1", productKey: "apples", productName: "Яблоки", packageQuantity: 500, packageUnit: "g", totalPrice: 100 }),
    observation({ id: "apples-2", productKey: "apples", productName: "Яблоки", date: "2026-08-20", packageQuantity: 1.2, packageUnit: "kg", totalPrice: 180 }),
  ]);

  assert.equal(row.normalizedUnit, "kg");
  assert.equal(row.previousUnitPrice, 200);
  assert.equal(row.currentUnitPrice, 150);
  assert.equal(row.absoluteDelta, -50);
  assert.equal(row.percentDelta, -25);
  assert.equal(row.status, "cheaper");
  assert.equal(row.valueSignal, "best_recorded");
  assert.match(row.summary, /дешевле на 50,00 ₽\/кг \(-25,0%\)/);
});

test("uses package count and preserves the original purchase details", () => {
  const current = observation({
    id: "yogurt-2",
    productKey: "yogurt",
    productName: "Йогурт",
    date: "2026-08-29",
    packageQuantity: 250,
    packageUnit: "g",
    packageCount: 3,
    totalPrice: 254.97,
  });
  const [row] = prices.analyzePriceHistory([current]);

  assert.equal(row.currentUnitPrice, 339.96);
  assert.equal(row.status, "first_observation");
  assert.equal(row.valueSignal, "insufficient_history");
  assert.deepEqual(row.current, current);
  assert.deepEqual(row.history[0].observation, current);
  assert.equal(row.history[0].normalizedQuantity, 0.75);
  assert.match(row.summary, /первая зафиксированная цена/);
});

test("compares the newest purchase with the previous one and prior history", () => {
  const [row] = prices.analyzePriceHistory([
    observation({ id: "milk-1", date: "2026-08-01", totalPrice: 90 }),
    observation({ id: "milk-2", date: "2026-08-10", totalPrice: 110 }),
    observation({ id: "milk-3", date: "2026-08-20", totalPrice: 120 }),
  ]);

  assert.equal(row.current.id, "milk-3");
  assert.equal(row.previous.id, "milk-2");
  assert.equal(row.currentUnitPrice, 120);
  assert.equal(row.previousUnitPrice, 110);
  assert.equal(row.absoluteDelta, 10);
  assert.equal(row.percentDelta, 9.1);
  assert.equal(row.historicalLow, 90);
  assert.equal(row.historicalAverage, 100);
  assert.equal(row.status, "more_expensive");
  assert.equal(row.valueSignal, "above_average");
  assert.equal(row.statusLabel, "Дороже прошлой покупки");
  assert.equal(row.valueLabel, "Дороже обычного");
});

test("classifies equal normalized prices as unchanged", () => {
  const [row] = prices.analyzePriceHistory([
    observation({ id: "milk-1", packageQuantity: 1, packageUnit: "l", totalPrice: 100 }),
    observation({ id: "milk-2", date: "2026-08-20", packageQuantity: 900, packageUnit: "ml", totalPrice: 90 }),
  ]);

  assert.equal(row.currentUnitPrice, 100);
  assert.equal(row.absoluteDelta, 0);
  assert.equal(row.percentDelta, 0);
  assert.equal(row.status, "same");
  assert.match(row.summary, /цена не изменилась/);
});

test("marks an exact SKU comparison without an analog caveat", () => {
  const [row] = prices.analyzePriceHistory([
    observation({ id: "milk-exact-1", totalPrice: 100 }),
    observation({ id: "milk-exact-2", date: "2026-08-20", totalPrice: 110 }),
  ]);

  assert.equal(row.currentComparability, "exact");
  assert.equal(row.currentComparabilityLabel, "Тот же товар — точное сравнение");
  assert.doesNotMatch(row.summary, /сравнение аналога\/другого бренда/);
});

test("labels an analog comparison as an orientation rather than an SKU price change", () => {
  const [row] = prices.analyzePriceHistory([
    observation({ id: "milk-brand-a", totalPrice: 100 }),
    observation({
      id: "milk-brand-b",
      date: "2026-08-20",
      comparability: "analog",
      totalPrice: 90,
    }),
  ]);

  assert.equal(row.status, "cheaper");
  assert.equal(row.currentComparability, "analog");
  assert.equal(row.currentComparabilityLabel, "Аналог или другой бренд — только ориентир");
  assert.match(row.summary, /сравнение аналога\/другого бренда, ориентир/);
});

test("uses input order as a stable tie-breaker for purchases on the same date", () => {
  const first = observation({ id: "milk-a", totalPrice: 100 });
  const second = observation({ id: "milk-b", totalPrice: 95 });
  const [row] = prices.analyzePriceHistory([first, second]);

  assert.equal(row.current.id, "milk-b");
  assert.equal(row.previous.id, "milk-a");
  assert.equal(row.status, "cheaper");
});

test("rejects duplicate observation identifiers", () => {
  assert.throws(() => prices.analyzePriceHistory([
    observation(),
    observation({ productKey: "eggs", productName: "Яйца", packageUnit: "pcs", packageQuantity: 10 }),
  ]), /используется повторно/);
});

test("rejects unsupported and incompatible units", () => {
  assert.throws(() => prices.analyzePriceHistory([
    observation({ packageUnit: "oz" }),
  ]), /Неизвестная единица/);

  assert.throws(() => prices.analyzePriceHistory([
    observation({ id: "item-1", productKey: "item", packageUnit: "kg" }),
    observation({ id: "item-2", productKey: "item", date: "2026-08-20", packageUnit: "l" }),
  ]), /несовместимые единицы/);
});

test("requires an explicit exact-or-analog comparability marker", () => {
  assert.throws(() => prices.analyzePriceHistory([
    observation({ comparability: undefined }),
  ]), /должна быть exact или analog/);
});

test("rejects invalid quantities, package counts, prices and dates", () => {
  assert.throws(() => prices.analyzePriceHistory([observation({ packageQuantity: 0 })]), /положительным числом/);
  assert.throws(() => prices.analyzePriceHistory([observation({ packageCount: 1.5 })]), /целым числом/);
  assert.throws(() => prices.analyzePriceHistory([observation({ totalPrice: 0 })]), /Общая цена/);
  assert.throws(() => prices.analyzePriceHistory([observation({ date: "не-дата" })]), /неверный формат/);
});
