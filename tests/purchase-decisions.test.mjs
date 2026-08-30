import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/purchase-decisions.ts", import.meta.url), "utf8");
const stripped = source
  .replace(/^import .*? from "\.\/shopping-planner";\r?\n/m, "")
  .replace(/export const nextMonthPurchaseDecisionPreview[\s\S]*$/m, "");
const compiled = ts.transpileModule(stripped, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const decisions = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const row = (overrides = {}) => ({
  productId: "cucumber",
  productName: "Огурцы",
  unit: "g",
  grossNeed: 900,
  homeAvailable: 700,
  alreadyPurchasedAvailable: 0,
  fromHome: 700,
  fromAlreadyPurchased: 0,
  expiredOrUnavailable: 0,
  netDeficit: 200,
  purchaseQuantity: 200,
  packageBreakdown: ["на вес × 200"],
  expectedCost: 62,
  projectedRemainder: 0,
  mealIds: ["salad"],
  ...overrides,
});

test("marks a real deficit as a purchase with an evidence-based reason", () => {
  const [decision] = decisions.buildPurchaseDecisions([row()]);
  assert.equal(decision.status, "to_buy");
  assert.equal(decision.expectedCost, 62);
  assert.match(decision.reason, /не хватает 200 г/);
});

test("distinguishes home stock and an already purchased lot", () => {
  const result = decisions.buildPurchaseDecisions([
    row({ productId: "tomato", productName: "Помидоры", grossNeed: 500, fromHome: 500, homeAvailable: 700, netDeficit: 0, purchaseQuantity: 0, packageBreakdown: [], expectedCost: 0, projectedRemainder: 200 }),
    row({ productId: "yogurt", productName: "Йогурт", grossNeed: 700, fromHome: 0, homeAvailable: 0, fromAlreadyPurchased: 700, alreadyPurchasedAvailable: 750, netDeficit: 0, purchaseQuantity: 0, packageBreakdown: [], expectedCost: 0, projectedRemainder: 50 }),
  ]);
  assert.equal(result[0].status, "removed_home_stock");
  assert.match(result[0].reason, /останется 200 г/);
  assert.equal(result[1].status, "already_purchased");
});

test("does not invent a price when the deficit has no priced package", () => {
  const [decision] = decisions.buildPurchaseDecisions([row({ purchaseQuantity: 0, packageBreakdown: [], expectedCost: 0 })]);
  assert.equal(decision.status, "missing_price");
  assert.equal(decision.expectedCost, null);
  assert.match(decision.reason, /Дефицит 200 г подтверждён/);
});

test("keeps manual unknown and home-check states explicit", () => {
  const result = decisions.buildPurchaseDecisions([], [
    { id: "oil", productName: "Масло", status: "check_home", reason: "Проверить остаток." },
    { id: "unknown", productName: "Неизвестная позиция", status: "unknown_purchase", reason: "Нет сообщения." },
  ]);
  assert.deepEqual(result.map((item) => item.status), ["check_home", "unknown_purchase"]);
  assert.deepEqual(result.map((item) => item.expectedCost), [null, null]);
});

test("rejects duplicate decision identifiers", () => {
  assert.throws(() => decisions.buildPurchaseDecisions([row()], [
    { id: "cucumber", productName: "Огурцы", status: "check_home", reason: "Повтор." },
  ]), /должны быть уникальны/);
});
