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

const [prices, data] = await Promise.all([
  importTypeScript("../app/price-history.ts"),
  importTypeScript("../app/price-observations.ts"),
]);

const rows = prices.analyzePriceHistory(data.priceObservations);

test("seeds a valid price history without duplicate observations", () => {
  assert.ok(data.priceObservations.length >= 40);
  assert.ok(rows.length >= 20);
  assert.equal(new Set(data.priceObservations.map((item) => item.id)).size, data.priceObservations.length);
});

test("records exact savings for repeated identical products", () => {
  const milk = rows.find((row) => row.productKey === "milk_domik");
  assert.equal(milk.currentUnitPrice, 101.57);
  assert.equal(milk.previousUnitPrice, 110.47);
  assert.equal(milk.percentDelta, -8.1);
  assert.equal(milk.currentComparability, "exact");
  assert.equal(milk.status, "cheaper");
});

test("labels functional substitutions as approximate comparisons", () => {
  const tomatoBase = rows.find((row) => row.productKey === "tomato_base");
  assert.equal(tomatoBase.previousUnitPrice, 259.98);
  assert.equal(tomatoBase.currentUnitPrice, 599.98);
  assert.equal(tomatoBase.percentDelta, 130.8);
  assert.equal(tomatoBase.currentComparability, "analog");
  assert.match(tomatoBase.summary, /сравнение аналога\/другого бренда, ориентир/);
});

test("keeps disliked fish prices in history without treating fish as usable stock", () => {
  assert.equal(data.excludedPriceProductKeys.has("pangasius"), true);
  assert.ok(rows.find((row) => row.productKey === "pangasius"));
});
