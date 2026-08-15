import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the revised monthly plan", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Питание на месяц для двоих/);
  assert.match(html, /Текущий бюджет/);
  assert.match(html, /Недели 2–4/);
  assert.match(html, /Что уже есть дома/);
});

test("keeps one current budget and records the new evidence", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /Выберите бюджет|data-budget|economy|30 000 ₽/);
  assert.match(page, /const budget = 25_000/);
  assert.match(page, /confirmedTotal/);
  assert.match(page, /Шампиньоны вместо лисичек/);
  assert.match(page, /13 шт\./);
  assert.match(layout, /og-v2\.png/);
});

test("has a complete, detailed recipe for every planned meal", async () => {
  const [page, details] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details.ts", import.meta.url), "utf8"),
  ]);

  const plannedMeals = [...page.matchAll(/^\s+meal\(/gm)].length;
  const detailedRecipes = [...details.matchAll(/^\s+"[234]:.+": \{$/gm)].length;
  const stepSections = [...details.matchAll(/steps:\s*\[([\s\S]*?)\n\s+\],/g)];

  assert.equal(plannedMeals, 33);
  assert.equal(detailedRecipes, plannedMeals);
  assert.equal(stepSections.length, plannedMeals);
  for (const [, section] of stepSections) {
    const steps = [...section.matchAll(/^\s+".+",$/gm)].length;
    assert.ok(steps >= 5 && steps <= 7, `expected 5–7 steps, got ${steps}`);
  }
  assert.match(details, /Разогрейте духовку до 200 °C/);
  assert.match(details, /Вода — 480 мл/);
  assert.match(details, /до горячего центра/);
  assert.match(page, /Все количества рассчитаны/);
});

test("rotates grains and limits rice on weeks three and four", async () => {
  const [page, details] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details.ts", import.meta.url), "utf8"),
  ]);

  const weekThreeStart = page.indexOf("number: 3");
  const weekFourStart = page.indexOf("number: 4");
  const weeksEnd = page.indexOf("const recipeCount");
  const weekThree = page.slice(weekThreeStart, weekFourStart);
  const weekFour = page.slice(weekFourStart, weeksEnd);

  assert.equal((weekThree.match(/Рис —/g) ?? []).length, 1);
  assert.equal((weekFour.match(/Рис —/g) ?? []).length, 1);
  assert.doesNotMatch(`${page}\n${details}`, /перлов/iu);
  assert.match(page, /Тёплый салат с креветками и белой фасолью/);
  assert.match(page, /Тёплый салат с кальмаром и кускусом/);
  assert.match(page, /Рис × 1/);
});
