import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const pagesRoot = new URL("../docs/", import.meta.url);

test("builds a standalone GitHub Pages site without a GPT redirect", async () => {
  const html = await readFile(new URL("index.html", pagesRoot), "utf8");
  const assets = await readdir(new URL("assets/", pagesRoot));

  assert.doesNotMatch(html, /http-equiv=["']refresh/i);
  assert.doesNotMatch(html, /santinoporchi\.chatgpt\.site/);
  assert.match(html, /\/nutrition-plan-for-two-spb\/assets\/[^"']+\.js/);
  assert.ok(assets.some((name) => name.endsWith(".js")), "JavaScript bundle is missing");
  assert.ok(assets.some((name) => name.endsWith(".css")), "CSS bundle is missing");
});

test("includes the current archive, receipts, and revised menu in the static bundle", async () => {
  const assets = await readdir(new URL("assets/", pagesRoot));
  const scriptName = assets.find((name) => name.endsWith(".js"));

  assert.ok(scriptName, "JavaScript bundle is missing");
  const script = await readFile(new URL(`assets/${scriptName}`, pagesRoot), "utf8");

  assert.match(script, /Питание на месяц для двоих/);
  assert.match(script, /Архив: первая неделя/);
  assert.match(script, /Архив: третья неделя и подтверждения/);
  assert.match(script, /Выгода продуктов и ценовые сигналы/);
  assert.match(script, /Тёплый салат с кальмаром и кускусом/);
  assert.match(script, /Тёплый салат с креветками и кускусом/);
  assert.match(script, /Пшённая каша с яблоком, ягодами и корицей/);
  assert.match(script, /Сырники с ягодами и йогуртом/);
  assert.match(script, /Масло сливочное/);
  assert.doesNotMatch(script, /Обычные блинчики с яблоком, корицей и йогуртом/);
  assert.match(script, /Омлет с Фетаксой, перцем и шоти-пури/);
  assert.match(script, /Каша «Дружба» с яблоком/);
  assert.match(script, /Курица с рисом, брокколи и свежим салатом/);
  assert.match(script, /6691\.15/);
  assert.match(script, /Креветки королевские очищенные/);
  assert.match(script, /Потребность минус остатки/);
  assert.match(script, /Белокочанная капуста и перловка/);
  assert.match(script, /Выходная выпечка/);
  assert.match(script, /Как факт месяца превратится в новый план/);
  assert.match(script, /29\.08 · чек «Лента»/);
  assert.match(script, /Закуплено · зафиксировано/);
  assert.match(script, /Сливы и персики съесть как перекус в первые дни/);
  assert.match(script, /После плана останется/);
  assert.match(script, /Закупки и цены/);
  assert.match(script, /База рецептов/);
  assert.match(script, /Рецепты и фактический результат/);
  assert.match(script, /Что готовили и что убрали/);
  assert.match(script, /Факт не подтверждён/);
  assert.match(script, /Планировали пропустить/);
  assert.match(script, /Память цен/);
  assert.match(script, /Дешевле прошлой покупки/);
  assert.match(script, /Аналог или другой бренд — только ориентир/);
  assert.match(script, /Убрано из закупки/);
  assert.doesNotMatch(script, /Промежуточный анализ/);
});
