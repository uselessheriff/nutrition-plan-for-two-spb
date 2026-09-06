
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root=new URL("../docs/",import.meta.url);
test("builds standalone Pages with correctly resolved current assets",async()=>{
 const html=await readFile(new URL("index.html",root),"utf8");
 assert.doesNotMatch(html,/http-equiv=["']refresh/i);
 assert.doesNotMatch(html,/santinoporchi\.chatgpt\.site/);
 assert.match(html,/\/nutrition-plan-for-two-spb\/assets\/[^"']+\.js/);
 const path=html.match(/src="\/nutrition-plan-for-two-spb\/(assets\/[^"]+\.js)"/)[1];
 const script=await readFile(new URL(path,root),"utf8");
 for(const label of ["Меню и архив","Что купить","Сначала остатки","Архив: первая неделя","29.08 · чек «Лента»","Europe/Moscow","Пошаговое приготовление"])assert(script.includes(label),label);
 for(const label of ["Новые 4 недели","Выгода продуктов и ценовые сигналы","Пример журнала следующего месяца","База рецептов"])assert(!script.includes(label),label);
 assert(script.includes("nutrition-plan.html?embed=1&view="));
});
test("publishes the same weekly shopping artifact as Sites",async()=>{
 const html=await readFile(new URL("nutrition-plan.html",root),"utf8");
 const canonical=await readFile(new URL("../public/nutrition-plan.html",import.meta.url),"utf8");
 assert.equal(html,canonical);
 assert(html.includes('id="shopping-weeks"'));
 assert(html.includes('Что купить на неделю'));
 assert(html.includes('const activeTier=1'));
 assert(!html.includes('id="budget-switch"'));
});
