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

test("renders the compact overview and mobile-visible page tabs", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Питание на месяц для двоих/);
  assert.match(html, /Текущий бюджет/);
  assert.match(html, /Календарь и факт/);
  assert.match(html, /Обзор/);
  assert.match(html, /Текущая неделя/);
  assert.match(html, /Меню и архив/);
  assert.match(html, /Закупки и цены/);
  assert.match(html, /База рецептов/);
  assert.match(html, /Правила/);
  assert.match(html, /4\s*165,51 ₽/);
  assert.match(html, /Действующий прогноз месяца/);
  assert.match(html, /Сегодня по Москве/);
  assert.match(html, /Сверяем московскую дату/);
  assert.doesNotMatch(html, /Промежуточный анализ/);
});

test("separates purchases, price memory, recipes, and rules into dedicated tabs", async () => {
  const [page, styles, priceMemory, decisions, mealHistory] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/price-memory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/purchase-decisions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/meal-history.ts", import.meta.url), "utf8"),
  ]);

  const pageTabBlock = page.slice(page.indexOf("const pageTabs"), page.indexOf("] as const", page.indexOf("const pageTabs")));
  assert.equal((pageTabBlock.match(/\{ id:/g) ?? []).length, 6);
  assert.match(page, /activePage === "purchases"/);
  assert.match(page, /activePage === "recipes"/);
  assert.match(page, /activePage === "rules"/);
  assert.match(page, /<PriceMemory \/>/);
  assert.match(page, /nextMonthPurchaseDecisionPreview/);
  assert.match(page, /Файлы чеков на публичный сайт не публикуются|без хранения самих файлов чеков/);
  assert.match(page, /getMealHistoryByMenuKey/);
  assert.match(page, /Рецепты и фактический результат/);
  assert.match(page, /Что готовили и что убрали/);
  assert.match(page, /if \(filter === "cooked"\) return item\.outcome === "cooked"/);
  assert.match(page, /const blocked = item\.preference === "blocked"/);
  assert.match(page, /disabled=\{blocked\}/);
  assert.doesNotMatch(page, /week\.number === 3 \|\|/);
  assert.match(mealHistory, /createMealMenuKey\(1, "Пицца с курицей, грибами и томатами"\)/);
  assert.match(mealHistory, /createMealMenuKey\(3, "Пангасиус с картофелем, фасолью и лимонным соусом"\)/);
  assert.match(mealHistory, /planned_to_skip/);
  assert.doesNotMatch(page, /Промежуточный анализ/);
  assert.match(styles, /\.page-tabs-shell \{ overflow-x: auto/);
  assert.match(priceMemory, /Память цен/);
  assert.match(priceMemory, /Тот же товар|currentComparabilityLabel/);
  assert.match(priceMemory, /Точно дешевле/);
  assert.match(priceMemory, /Сравнений-аналогов/);
  assert.match(decisions, /Убрано из закупки/);
  assert.match(decisions, /Нет данных о закупке/);
});

test("keeps one budget and reconciles the locked fourth-week purchase without duplicates", async () => {
  const [page, data, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plan-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /Выберите бюджет|data-budget|economy|30 000 ₽/);
  assert.match(page, /const budget = 25_000/);
  assert.match(page, /archivedActualTotal/);
  assert.doesNotMatch(page, /const currentWeek = weeks\.find\(\(week\) => week\.number === 4\)/);
  assert.match(page, /getPlanCalendar/);
  assert.match(page, /calendar\?\.activePlanWeek/);
  assert.match(page, /Дата РФ · московское время/);
  assert.match(page, /Текущая по Москве/);
  assert.match(page, /Сейчас нет активной недели в этом плане/);
  assert.match(page, /Итог подтверждённых закупок цикла/);
  assert.match(page, /Покупки после 6 сентября относятся уже к следующему циклу/);
  assert.match(page, /archive-week-tab-/);
  assert.match(page, /exact\(3895\.51\)/);
  assert.match(data, /source: "16\.08 · чек"/);
  assert.match(data, /source: "21\.08 · чек · неделя 3"/);
  assert.match(data, /source: "22\.08 · чек «Лента»"/);
  assert.match(data, /actualTotal: 3785\.39/);
  assert.match(data, /actualTotal: 6691\.15/);
  assert.match(data, /number: 1/);
  assert.match(data, /number: 2/);
  assert.match(data, /name: "Яйца", quantity: "11 шт\."/);
  assert.match(data, /title: "Картофельное пюре"/);
  assert.equal((data.match(/source: "21\.08 · чек · неделя 3"/g) ?? []).length, 8);

  const expenseBlock = data.slice(data.indexOf("export const expenses"), data.indexOf("export const stock"));
  const expenseTotal = [...expenseBlock.matchAll(/amount: ([\d.]+)/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(Number(expenseTotal.toFixed(2)), 15525.53);
  const weekFourPurchaseBlock = data.slice(data.indexOf("export const weekFourPurchases"), data.indexOf("export const foodPreferences"));
  const weekFourPurchaseTotal = [...weekFourPurchaseBlock.matchAll(/, ([\d.]+)(?:, "(?:extra|snack)")?\),?$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(Number(weekFourPurchaseTotal.toFixed(2)), 4165.51);
  assert.match(data, /name: "Тортильи на 30 августа, не для недели 4"/);
  assert.doesNotMatch(weekFourPurchaseBlock, /Тортильи/);
  assert.match(data, /status: "purchased_locked"/);
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
  assert.match(revisedDetails, /Это точечная замена белой рыбы продуктом из уже оплаченного чека/);
  assert.match(page, /Меню и сохранённые рецепты/);
  assert.match(page, /Метка показывает результат, а не просто наличие блюда в плане/);
  assert.match(legacyDetails, /filter\(\(\[key\]\) => key\.startsWith\("2:"\)\)/);
});

test("rotates grains, keeps rice as a side dish once, and diversifies weekend breakfasts", async () => {
  const [data, revisedDetails] = await Promise.all([
    readFile(new URL("../app/plan-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/recipe-details-revised.ts", import.meta.url), "utf8"),
  ]);

  const weekThreeStart = data.indexOf("number: 3");
  const weekFourStart = data.indexOf("number: 4");
  const weeksEnd = data.lastIndexOf("];\n");
  const weekThree = data.slice(weekThreeStart, weekFourStart);
  const weekFour = data.slice(weekFourStart, weeksEnd);

  assert.equal((weekThree.match(/Рис —/g) ?? []).length, 0);
  assert.match(weekFour, /Рис как гарнир × 1/);
  assert.match(weekFour, /Каша «Дружба» с яблоком/);
  assert.match(weekFour, /Рис — 1 пакетик из остатка/);
  assert.match(weekFour, /Курица с рисом, брокколи и свежим салатом/);
  assert.match(weekThree, /Пшённая каша с яблоком, ягодами и корицей/);
  assert.match(weekThree, /Сырники с ягодами и йогуртом/);
  assert.match(weekThree, /Пшено — 80 г/);
  assert.match(weekThree, /shopping: \[\]/);
  assert.match(weekThree, /actualTotal: 6691\.15/);
  assert.doesNotMatch(weekThree, /Обычные блинчики с яблоком, корицей и йогуртом/);
  assert.match(weekFour, /Омлет с Фетаксой, перцем и шоти-пури/);
  assert.match(weekFour, /Яйца — 4 шт\. из остатка/);

  const eggsFromStock = [...weekFour.matchAll(/Яйц[ао] — (\d+) шт\. из остатка/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(eggsFromStock, 11);
  assert.doesNotMatch(`${weekFour}\n${revisedDetails.slice(revisedDetails.indexOf('"4:'))}`, /перлов/iu);
  assert.match(data, /Тёплый салат с креветками и кускусом/);
  assert.match(data, /Овощная мусака с фасолью и баклажанами/);
  assert.match(data, /Брокколи «Морозко Green»/);
  assert.match(data, /Брокколи — 400 г из покупки/);
  assert.match(data, /Белую рыбу не размораживать и не использовать/);

  const riceSideMeals = weekFour.match(/meal\("[^"]+", "[^"]+", "[^"]*с рисом[^"]*"/g) ?? [];
  assert.equal(riceSideMeals.length, 1);
  assert.doesNotMatch(weekFour, /meal\([^\n]*(Филе рыбы|Пангасиус|белая рыба)/iu);
  assert.match(weekFour, /Куриное филе — 250 г из покупки/);
  assert.match(weekFour, /Фарш индейки — 400 г из остатка/);
  assert.match(weekFour, /Говяжий фарш — 300 г из остатка/);
  assert.match(weekFour, /Овощное рагу — 400 г из остатка/);
  assert.match(weekFour, /Картофель — 600 г из остатка/);
  assert.match(weekFour, /Картофель — 700 г из остатка/);
  assert.equal((weekFour.match(/Фетакса — 100 г из остатка/g) ?? []).length, 2);

  const futureMenuAndRecipes = `${weekFour}\n${revisedDetails.slice(revisedDetails.indexOf('"4:'))}`;
  assert.doesNotMatch(futureMenuAndRecipes, /капуст/iu);
  assert.doesNotMatch(futureMenuAndRecipes, /стручков/iu);
  assert.match(data, /Стручковая фасоль.*Не подавать отдельно/);
  assert.match(data, /Выходная выпечка/);
  assert.match(data, /Купили \/ не купили/);
  assert.match(data, /Размер порций/);
  assert.match(data, /оставшиеся после каши 398 г яблок и 70 г йогурта/);
  assert.match(data, /остальные 2,94 л — только для питья/);
  assert.match(weekThree, /Пшено/);
});
