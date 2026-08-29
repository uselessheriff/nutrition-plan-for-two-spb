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

test("renders the four-week plan, archive, and purchase analysis", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Питание на месяц для двоих/);
  assert.match(html, /Текущий бюджет/);
  assert.match(html, /Недели 1–4/);
  assert.match(html, /Экономическая полезность продуктов/);
  assert.match(html, /Оставшаяся рыба с рисом, брокколи и салатом/);
  assert.match(html, /Неделя 1 · архив/);
  assert.match(html, /Неделя 3 · архив/);
  assert.match(html, /4\s*290 ₽/);
});

test("keeps one budget and reconciles three completed weeks without duplicates", async () => {
  const [page, data, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plan-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /Выберите бюджет|data-budget|economy|30 000 ₽/);
  assert.match(page, /const budget = 25_000/);
  assert.match(page, /archivedActualTotal/);
  assert.match(page, /useState\(4\)/);
  assert.match(page, /exact\(783\.57\)/);
  assert.match(data, /source: "16\.08 · чек"/);
  assert.match(data, /source: "21\.08 · чек · неделя 3"/);
  assert.match(data, /source: "22\.08 · чек «Лента»"/);
  assert.match(data, /actualTotal: 3785\.39/);
  assert.match(data, /actualTotal: 6561\.15/);
  assert.match(data, /number: 1/);
  assert.match(data, /number: 2/);
  assert.match(data, /name: "Яйца", quantity: "11 шт\."/);
  assert.equal((data.match(/source: "21\.08 · чек · неделя 3"/g) ?? []).length, 8);

  const expenseBlock = data.slice(data.indexOf("export const expenses"), data.indexOf("export const stock"));
  const expenseTotal = [...expenseBlock.matchAll(/amount: ([\d.]+)/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(Number(expenseTotal.toFixed(2)), 15395.53);
  assert.match(layout, /og-v2\.png/);
});

test("has a complete detailed recipe for each planned and archived meal", async () => {
  const [page, data, legacyDetails, revisedDetails] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plan-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details-revised.ts", import.meta.url), "utf8"),
  ]);

  const plannedMeals = [...data.matchAll(/^\s+meal\(/gm)].length;
  const revisedRecipes = [...revisedDetails.matchAll(/^\s+"[134]:.+": \{$/gm)].length;
  const weekTwoRecipes = [...legacyDetails.matchAll(/^\s+"2:.+": \{$/gm)].length;

  assert.equal(plannedMeals, 40);
  assert.equal(revisedRecipes, 29);
  assert.equal(weekTwoRecipes, 11);
  assert.match(page, /Object\.keys\(recipeDetails\)\.length !== recipeCount/);
  assert.match(revisedDetails, /Кальмар 500 г разморозьте только в холодильнике/);
  assert.match(revisedDetails, /Накануне переложите замороженные 300 г рыбы/);
  assert.match(page, /точные количества и 5–7 шагов/);
  assert.match(legacyDetails, /filter\(\(\[key\]\) => key\.startsWith\("2:"\)\)/);
});

test("rotates grains, keeps rice as a side dish once, and diversifies weekend breakfasts", async () => {
  const [data, legacyDetails, revisedDetails] = await Promise.all([
    readFile(new URL("../app/plan-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details-revised.ts", import.meta.url), "utf8"),
  ]);

  const weekThreeStart = data.indexOf("number: 3");
  const weekFourStart = data.indexOf("number: 4");
  const weeksEnd = data.lastIndexOf("];\n");
  const weekThree = data.slice(weekThreeStart, weekFourStart);
  const weekFour = data.slice(weekFourStart, weeksEnd);

  assert.equal((weekThree.match(/Рис —/g) ?? []).length, 0);
  assert.match(weekFour, /единственный рисовый гарнир недели/);
  assert.match(weekFour, /Каша «Дружба» с яблоком/);
  assert.match(weekFour, /Рис — 1 пакетик из остатка/);
  assert.match(weekFour, /Оставшаяся рыба с рисом, брокколи и салатом/);
  assert.match(weekThree, /Пшённая каша с яблоком, ягодами и корицей/);
  assert.match(weekThree, /Сырники с ягодами и йогуртом/);
  assert.match(weekThree, /Пшено — 80 г/);
  assert.match(weekThree, /shopping: \[\]/);
  assert.match(weekThree, /actualTotal: 6561\.15/);
  assert.doesNotMatch(weekThree, /Обычные блинчики с яблоком, корицей и йогуртом/);
  assert.match(weekFour, /Омлет с Фетаксой, перцем и питой/);
  assert.match(weekFour, /Яйца — 4 шт\. из остатка/);

  const eggsFromStock = [...weekFour.matchAll(/Яйц[ао] — (\d+) шт\. из остатка/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(eggsFromStock, 11);
  assert.doesNotMatch(`${data}\n${revisedDetails}`, /перлов/iu);
  assert.match(data, /Тёплый салат с креветками и кускусом/);
  assert.match(data, /Овощная мусака с фасолью и баклажанами/);
  assert.match(data, /Брокколи замороженная, 400 г/);
  assert.match(data, /Брокколи — 500 г/);
  assert.match(data, /Рыба и оба фарша находятся в морозилке/);

  const riceSideMeals = weekFour.match(/meal\("[^"]+", "[^"]+", "[^"]*с рисом[^"]*"/g) ?? [];
  assert.equal(riceSideMeals.length, 1);
  assert.match(weekFour, /Филе рыбы — 300 г из остатка/);
  assert.match(weekFour, /Фарш индейки — 400 г из остатка/);
  assert.match(weekFour, /Говяжий фарш — 300 г из остатка/);
  assert.match(weekFour, /Овощное рагу — 400 г из остатка/);
  assert.match(weekFour, /Картофель — 600 г из остатка/);
  assert.match(weekFour, /Картофель — 700 г из остатка/);
  assert.equal((weekFour.match(/Фетакса — 100 г из остатка/g) ?? []).length, 2);

  const menuAndRecipes = `${data.slice(data.indexOf("export const baseWeeks"))}\n${legacyDetails}\n${revisedDetails}`;
  assert.doesNotMatch(menuAndRecipes, /капуст/iu);
  assert.match(weekThree, /Пшено/);
});
