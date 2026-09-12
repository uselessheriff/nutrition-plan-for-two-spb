
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import "../plan-source/recipes.mjs";
import { calculate, weeks, recipeFor, mealEntries, slots } from "../plan-source/model.mjs";
const read=(name)=>readFile(new URL("../"+name,import.meta.url),"utf8");
async function moduleFrom(name){const compiled=ts.transpileModule(await read(name),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));}
test("renders four useful sections with weeks 1–8 and week 6 selected",async()=>{
 const {default:worker}=await import(new URL("../dist/server/index.js",import.meta.url));
 const response=await worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
 assert.equal(response.status,200);
 const html=await response.text();
 for(const id of ["archive","purchases","stock","expenses"])assert(html.includes('page-tab-'+id));
 for(let n=1;n<=8;n++)assert(html.includes('archive-week-tab-'+n));
 assert.match(html,/aria-pressed="true"[^>]*|Неделя 5/);
 assert(html.includes("Тунец и домашняя классика"));
 for(const removed of ["Новые 4 недели","Пример журнала","Выгода продуктов и ценовые сигналы","База рецептов","Выберите месячный лимит"])assert(!html.includes(removed),removed);
});
test("generates archived week5 and nine meals per future week from the same fixed-25k shopping source",async()=>{
 const data=await moduleFrom("app/future-plan-data.ts");
 assert.deepEqual(data.futureMenuWeeks.map(w=>w.number),[5,6,7,8]);
 assert.equal(data.futurePlanTotal,calculate(1).total);assert.equal(data.futureConfirmedTotal,3331.3);assert.equal(data.futureRemainingTotal,calculate(1).remainingTotal);
 assert.deepEqual(data.futureWeekTotals,calculate(1).weeks.map(w=>w.total));
 assert.equal(data.futureMenuWeeks.flatMap(w=>w.meals).length,38);
 for(let i=0;i<4;i++)for(let j=0;j<mealEntries(i).length;j++){
  const meal=data.futureMenuWeeks[i].meals[j],recipe=recipeFor(mealEntries(i)[j].id,1);
  assert.equal(meal.day,slots[mealEntries(i)[j].slot][0]);assert.equal(meal.type,slots[mealEntries(i)[j].slot][1]);assert.equal(meal.title,recipe.title);assert.deepEqual(meal.recipe.steps,recipe.steps);
  assert.equal(meal.recipe.ingredients.length,Object.keys(recipe.items).length);
  assert.equal(meal.recipe.portions,recipe.portions+' порции');
  assert.match(meal.batch,new RegExp(recipe.portions+' порции.*ккал'));
 }
});
test("keeps historical accounting separate from future weeks and never invents cooked status",async()=>{
 const data=await moduleFrom("app/plan-data.ts");
 const previous=data.expenses.reduce((s,x)=>s+x.amount,0);
 const fourth=data.weekFourPurchases.reduce((s,x)=>s+x.price,0);
 assert.equal(Number(previous.toFixed(2)),15525.53);
 assert.equal(Number(fourth.toFixed(2)),5075.51);
 assert.equal(Number((previous+fourth).toFixed(2)),20601.04);
 const page=await read("app/page.tsx");
 assert.match(page,/const menuWeeks=\[\.\.\.historicalWeeks,\.\.\.futureMenuWeeks\]/);
 assert.match(page,/const confirmedPurchases=\[\.\.\.expenses,/);
 assert.doesNotMatch(page,/confirmedTotal\s*\/\s*menuWeeks.length/);
 assert(page.includes('weekNumber<=5?"unconfirmed":"planned"'));
 assert(page.includes('history?.outcome'));
 assert.match(page,/event\.origin!==window\.location\.origin/);
 assert.match(page,/event\.source!==frame\.current\?\.contentWindow/);
});
test("preserves historical recipe detail files and removed presentation in project history",async()=>{
 const legacy=await read("app/recipe-details.ts"),revised=await read("app/recipe-details-revised.ts");
 assert.equal((revised.match(/^\s+"[134]:.+": \{$/gm)||[]).length,29);
 assert.equal((legacy.match(/^\s+"2:.+": \{$/gm)||[]).length,11);
 const archived=await read("history/2026-09-06-before-simplification/page.tsx.txt");
 assert(archived.includes("Выгода продуктов и ценовые сигналы"));
 assert(archived.includes("Пример журнала следующего месяца"));
 const page=await read("app/page.tsx");
 assert(page.includes('role="dialog"'));assert(page.includes('aria-modal="true"'));
 assert(page.includes('event.key==="Escape"'));assert(page.includes("recipeTrigger?.focus()"));
});
