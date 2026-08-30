import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/shopping-planner.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const planner = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const product = (overrides = {}) => ({
  id: "item",
  name: "Продукт",
  unit: "g",
  purchaseOptions: [{ label: "500 г", quantity: 500, price: 100 }],
  ...overrides,
});

test("subtracts usable home stock and already-purchased stock exactly once", () => {
  const [row] = planner.calculateShopping({
    products: [product()],
    demands: [{ productId: "item", quantity: 1_000, unit: "g", needOn: "2026-09-06", mealId: "dinner" }],
    inventory: [
      { id: "home", productId: "item", quantity: 400, unit: "g", source: "home", useBy: "2026-09-07" },
      { id: "paid", productId: "item", quantity: 300, unit: "g", source: "already_purchased", useBy: "2026-09-07" },
    ],
  });

  assert.equal(row.grossNeed, 1_000);
  assert.equal(row.homeAvailable, 400);
  assert.equal(row.alreadyPurchasedAvailable, 300);
  assert.equal(row.fromHome, 400);
  assert.equal(row.fromAlreadyPurchased, 300);
  assert.equal(row.netDeficit, 300);
  assert.equal(row.purchaseQuantity, 500);
  assert.equal(row.projectedRemainder, 200);
});

test("rejects a duplicated inventory lot before it can be counted twice", () => {
  assert.throws(() => planner.calculateShopping({
    products: [product()],
    demands: [{ productId: "item", quantity: 500, unit: "g", needOn: "2026-09-06", mealId: "dinner" }],
    inventory: [
      { id: "same-lot", productId: "item", quantity: 300, unit: "g", source: "home" },
      { id: "same-lot", productId: "item", quantity: 300, unit: "g", source: "already_purchased" },
    ],
  }), /партий запаса должны быть уникальны/);
});

test("warns when perishable home stock remains after the full menu", () => {
  const [row] = planner.calculateShopping({
    products: [product({ perishable: true })],
    demands: [{ productId: "item", quantity: 500, unit: "g", needOn: "2026-09-06", mealId: "salad" }],
    inventory: [{ id: "home-produce", productId: "item", quantity: 700, unit: "g", source: "home", useBy: "2026-09-07" }],
  });

  assert.equal(row.projectedRemainder, 200);
  assert.match(row.warning, /останется 200 g скоропортящегося продукта/);
});

test("ignores a lot that expires before the dated demand", () => {
  const [row] = planner.calculateShopping({
    products: [product()],
    demands: [{ productId: "item", quantity: 500, unit: "g", needOn: "2026-09-10", mealId: "late-dinner" }],
    inventory: [{ id: "expired", productId: "item", quantity: 500, unit: "g", source: "home", useBy: "2026-09-05" }],
  });

  assert.equal(row.fromHome, 0);
  assert.equal(row.expiredOrUnavailable, 500);
  assert.equal(row.netDeficit, 500);
  assert.equal(row.purchaseQuantity, 500);
  assert.equal(row.projectedRemainder, 0);
});

test("chooses the cheapest pack combination that covers the deficit", () => {
  const [row] = planner.calculateShopping({
    products: [product({ purchaseOptions: [
      { label: "500 г", quantity: 500, price: 120 },
      { label: "300 г", quantity: 300, price: 80 },
    ] })],
    demands: [{ productId: "item", quantity: 800, unit: "g", needOn: "2026-09-02", mealId: "meal" }],
    inventory: [],
  });

  assert.equal(row.purchaseQuantity, 800);
  assert.equal(row.expectedCost, 200);
  assert.deepEqual(row.packageBreakdown, ["500 г × 1", "300 г × 1"]);
});

test("buys loose produce at the exact deficit and skips fully covered produce", () => {
  const rows = planner.calculateShopping({
    products: [
      product({ id: "cucumber", name: "Огурцы", purchaseOptions: [{ label: "на вес", quantity: 1, price: 0.31 }] }),
      product({ id: "tomato", name: "Помидоры", purchaseOptions: [{ label: "на вес", quantity: 1, price: 0.3 }] }),
    ],
    demands: [
      { productId: "cucumber", quantity: 900, unit: "g", needOn: "2026-09-06", mealId: "salads" },
      { productId: "tomato", quantity: 500, unit: "g", needOn: "2026-09-06", mealId: "salads" },
    ],
    inventory: [
      { id: "cucumber-home", productId: "cucumber", quantity: 700, unit: "g", source: "home" },
      { id: "tomato-home", productId: "tomato", quantity: 700, unit: "g", source: "home" },
    ],
  });

  const cucumber = rows.find((row) => row.productId === "cucumber");
  const tomato = rows.find((row) => row.productId === "tomato");
  assert.equal(cucumber.purchaseQuantity, 200);
  assert.equal(cucumber.expectedCost, 62);
  assert.equal(tomato.purchaseQuantity, 0);
  assert.equal(tomato.projectedRemainder, 200);
});

test("counts recipe ingredients once when later servings are leftovers", () => {
  const demands = planner.buildDemandsFromPlan({
    recipes: [{ id: "moussaka", yieldServings: 4, ingredients: [{ productId: "item", quantity: 700, unit: "g" }] }],
    cookEvents: [{ id: "sat-cook", recipeId: "moussaka", cookOn: "2026-09-05", batches: 1 }],
    serveEvents: [
      { id: "sat-dinner", cookEventId: "sat-cook", servings: 2 },
      { id: "sun-lunch", cookEventId: "sat-cook", servings: 2 },
    ],
  });

  assert.deepEqual(demands, [{ productId: "item", quantity: 700, unit: "g", needOn: "2026-09-05", mealId: "sat-cook" }]);
});

test("rejects serving more leftovers than a cooked batch produced", () => {
  assert.throws(() => planner.buildDemandsFromPlan({
    recipes: [{ id: "dish", yieldServings: 2, ingredients: [{ productId: "item", quantity: 200, unit: "g" }] }],
    cookEvents: [{ id: "cook", recipeId: "dish", cookOn: "2026-09-01", batches: 1 }],
    serveEvents: [{ id: "serve", cookEventId: "cook", servings: 3 }],
  }), /подано больше порций/);
});

test("refuses to regenerate an already-purchased week", () => {
  assert.throws(() => planner.calculatePlanShopping({
    status: "purchased_locked",
    products: [product()],
    demands: [{ productId: "item", quantity: 500, unit: "g", needOn: "2026-09-01", mealId: "meal" }],
    inventory: [],
  }), /нельзя полностью пересчитать/);
});

test("keeps the user's next-month preferences machine-readable", () => {
  assert.deepEqual(planner.nextMonthRules.forbiddenProducts, ["white_fish", "white_cabbage", "pearl_barley"]);
  assert.equal(planner.nextMonthRules.greenBeans, "mix_only");
  assert.equal(planner.nextMonthRules.broccoli, "allowed");
  assert.equal(planner.nextMonthRules.maxRiceSideMealsPerWeek, 1);
  assert.deepEqual(planner.nextMonthRules.weekendBakingLunchesPerMonth, { min: 1, max: 2 });
});
