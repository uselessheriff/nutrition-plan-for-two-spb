import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../plan-source/recipes.mjs';
import {calculate,recipeFor,mealEntries,calories,currentIngredient} from '../plan-source/model.mjs';
import {weekTwelveStock,weekElevenPurchases,weekElevenExtras,weekElevenReceiptTotal,weekElevenReportedTotal} from '../plan-source/week-twelve.mjs';
const cents=rows=>rows.reduce((s,r)=>s+Math.round(r.amount*100),0);
test('18 receipt lines plus one undivided extra are counted once; delivery stays unknown',()=>{
 assert.equal(weekElevenPurchases.length,18);assert.equal(cents(weekElevenPurchases),341345);
 assert.equal(weekElevenReceiptTotal,3413.45);assert.equal(weekElevenExtras.length,1);assert.equal(cents(weekElevenExtras),150000);
 const p=calculate();assert.equal(p.weeks[6].total,weekElevenReportedTotal);assert.equal(p.weeks[6].total,4913.45);
 assert(p.weeks[6].isActual);assert.equal(p.weeks[6].originalPlanTotal,5676.03);
 assert.equal(p.weeks[6].delivery,null);assert.equal(p.weeks[6].completeTotal,null);assert(p.deliveryPending);
 assert.equal(p.currentCycleConfirmed,13563.48);assert.equal(p.remainingTotal,p.weeks[7].total);
 assert.equal(p.total,Math.round((13563.48+p.remainingTotal)*100)/100);assert.equal(p.weeks[7].delivery,0);
});
test('new stock replaces carryover, all purchases conserve quantities and round to packs',()=>{
 const p=calculate(),w=p.weeks[7];
 for(const r of w.rows){
  if(r.opening===null){assert.equal(r.purchase,0);assert.equal(r.closing,null);continue;}
  assert.equal(r.opening,weekTwelveStock[r.id]||0,r.id);
  assert.equal(r.opening+r.purchase-r.used,r.closing,r.id);assert(r.closing>=0,r.id);
  assert.equal(r.purchase,Math.max(0,Math.ceil((r.used-r.opening)/r.pack-1e-9))*r.pack,r.id);
 }
 for(const id of ['chicken','mixedmince','fish','couscous','rice','tomato','passata','milk']){
  const r=w.rows.find(r=>r.id===id);assert.equal(r.purchase,0,id);assert.equal(r.closing,0,id);
 }
 assert.equal(w.remaining.onion,10);assert.equal(w.remaining.carrot,80);assert.equal(w.remaining.dough,100);
 assert.equal(w.remaining.peas,500);assert.equal(w.remaining.oats,120);assert.equal(w.remaining.bulgur,60);assert.equal(w.remaining.semolina,225);
 assert(!w.rows.some(r=>r.id==='readycutlets'));assert(!Object.hasOwn(weekTwelveStock,'readycutlets'));
 assert.equal(w.rows.find(r=>r.id==='milk').used,500);assert.equal(w.rows.find(r=>r.id==='flour').used,110);
 assert.equal(w.rows.find(r=>r.id==='flour').opening,null);
 for(const id of ['oil','butter','salt']){const row=w.rows.find(r=>r.id===id);assert.equal(row.opening,null);assert.equal(row.purchase,0);assert.equal(row.cost,0);}
});
test('only current-week grain inputs affect buying; archive remains unchanged',()=>{
 const original=calculate(),changed=calculate(1,{couscous:150,rice:50,bulgur:60});
 assert.deepEqual(changed.weeks.slice(0,7),original.weeks.slice(0,7));
 assert.equal(changed.weeks[7].rows.find(r=>r.id==='couscous').purchase,400);
 assert.equal(changed.weeks[7].rows.find(r=>r.id==='rice').purchase,500);
});
test('nine recipes preserve portions, hearty breakfasts and excluded ingredients',()=>{
 const entries=mealEntries(7);assert.equal(entries.length,9);
 for(const {id,slot} of entries){const r=recipeFor(id);
  assert.equal(r.portions,[4,5,7,8].includes(slot)?2:3,id);assert(r.steps.length>=4,id);
  for(const forbidden of ['cabbage','peking','sauerkraut','barley','apple','readycutlets'])assert.equal(r.items[forbidden],undefined,id);
  assert(!r.title.includes('суп'));assert(calories(r)>300,id);
 }
 assert(calories(recipeFor('o12satB'))>=600);assert(calories(recipeFor('o12sunB'))>=550);
 assert.equal(recipeFor('o12sunD').items.milk,undefined);
 assert.equal(currentIngredient('mixedmince',7).name,'Фарш свиной');
 assert.equal(currentIngredient('yogurt',7).pack,180);
 assert.equal(currentIngredient('yogurt',6).pack,250);
});
test('public generated view contains week12, sanitized receipt and no private identifiers',async()=>{
 const html=await readFile(new URL('../public/nutrition-plan.html',import.meta.url),'utf8');
 assert(html.includes("activeWeek=7"));assert(html.includes("snapshot='2026-10-25'"));assert(html.includes('Остатки перед неделей 12'));
 assert(html.includes('4913.45'));assert(html.includes('3413.45'));
 for(const bad of ['check.yandex.ru','7382441000423987','2906630588','nutrition-memory/receipt-week11','@yandex.ru'])assert(!html.includes(bad),bad);
});
