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
  assert.match(script, /Экономическая полезность продуктов/);
  assert.match(script, /Тёплый салат с кальмаром и кускусом/);
  assert.match(script, /Тёплый салат с креветками, белой фасолью и кускусом/);
  assert.match(script, /Пшённая каша с яблоком, ягодами и корицей/);
  assert.match(script, /Сырники с ягодами и йогуртом/);
  assert.match(script, /Масло сливочное/);
  assert.doesNotMatch(script, /Обычные блинчики с яблоком, корицей и йогуртом/);
  assert.match(script, /Омлет с Фетаксой, перцем и питой/);
  assert.match(script, /Каша «Дружба» с яблоком/);
  assert.match(script, /Брокколи замороженная, 400 г/);
  assert.doesNotMatch(script, /капуст/iu);
  assert.doesNotMatch(script, /перловк/iu);
});
