import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../plan-source/recipes.mjs';
import {calculate,recipeFor,mealEntries,currentIngredient} from '../plan-source/model.mjs';
import {weekElevenStock,weekTenPurchases,weekTenExtras,weekTenReceiptTotal,weekTenReportedTotal} from '../plan-source/week-eleven.mjs';
const cents=rows=>rows.reduce((s,r)=>s+Math.round(r.amount*100),0);
test('week10 receipt is 24 food rows plus three separate reported extras, once',()=>{
 assert.equal(weekTenPurchases.length,24);assert.equal(cents(weekTenPurchases),393964);
 assert.equal(cents(weekTenExtras),93000);assert.equal(weekTenExtras.length,3);
 assert(weekTenPurchases.every(r=>r.date==='10.10.2026'&&r.period==='w5'));
 assert.equal(Math.round(weekTenReceiptTotal*100)+93000,Math.round(weekTenReportedTotal*100));
 const p=calculate();assert.equal(p.weeks[5].total,4869.64);assert(p.weeks[5].isActual);
 assert.equal(p.weeks[4].total,3780.39);assert.equal(p.currentCycleConfirmed,8650.03);
 assert.equal(p.confirmed,16726.64);assert.equal(p.total,Math.round((8650.03+p.remainingTotal)*100)/100);
 assert(p.total<25000);
});
test('week11 pantry replaces forecast, purchases use only deficits and package rounding',()=>{
 const p=calculate(),w=p.weeks[6];
 for(const r of w.rows){if(r.opening===null)continue;assert.equal(r.opening,weekElevenStock[r.id]||0,r.id);assert.equal(r.opening+r.purchase-r.used,r.closing,r.id);assert(r.closing>=0,r.id);}
 for(const id of ['pork','rice','bulgur','broccoli','flour','milk','semolina','sugar'])assert.equal(w.rows.find(r=>r.id===id).purchase,0,id);
 const curd=w.rows.find(r=>r.id==='curd');assert.equal(curd.used,750);assert.equal(curd.opening,200);assert.equal(curd.purchase,600);
 assert.equal(w.remaining.peas,690);assert.equal(w.remaining.pasta,50);assert.equal(w.remaining.couscous,180);
 assert.equal(w.remaining.bulgur,0);assert.equal(w.remaining.rice,90);
 assert.equal(w.rows.find(r=>r.id==='onion').purchase,200);assert.equal(w.rows.find(r=>r.id==='egg').purchase,10);
 assert.equal(w.rows.find(r=>r.id==='butter').purchase,180);assert.equal(w.rows.find(r=>r.id==='mustard').purchase,140);
 const amended=calculate(1,{rice:10,bulgur:10,couscous:10});
 assert.deepEqual(amended.weeks.slice(0,6),p.weeks.slice(0,6));assert.equal(amended.weeks[6].rows.find(r=>r.id==='rice').opening,10);
});
test('one delivery exception has an unknown fee, not zero or a known all-in total',()=>{
 const p=calculate();const w=p.weeks[6];
 assert.equal(w.delivery,null);assert(w.deliveryPending);assert.equal(w.completeTotal,null);assert(p.deliveryPending);
 assert.equal(w.total,Math.round((w.food+w.buffer)*100)/100);assert.equal(p.weeks[7].delivery,0);assert(!p.weeks[7].deliveryPending);
});
test('two requested replacements have matching recipe ingredients and net purchases',()=>{
 const tue=recipeFor('o11tue'),sat=recipeFor('o11satD'),w=calculate().weeks[6];
 assert.equal(tue.title,'Бефстроганов с пастой');assert.equal(tue.portions,3);assert.equal(tue.time,100);
 assert.deepEqual(tue.items,{beef:400,pasta:180,onion:120,sourcream:150,flour:10,butter:10,oil:8,mustard:10,salt:3,spices:1});
 assert(tue.steps.some(s=>s.includes('45–75 минут')));assert(tue.steps.some(s=>s.includes('Ани в среду')));
 assert.equal(sat.title,'Красная рыба в духовке с картофелем и брокколи');assert.equal(sat.portions,2);
 assert.deepEqual(sat.items,{fish:350,potato:300,broccoli:200,yogurt:80,lemon:10,oil:8,salt:2,spices:1});
 assert(sat.steps.some(s=>s.includes('Соус подайте отдельно')));
 const pasta=w.rows.find(r=>r.id==='pasta');assert.equal(pasta.opening,230);assert.equal(pasta.used,180);assert.equal(pasta.purchase,0);
 assert.equal(w.rows.find(r=>r.id==='beef').purchase,400);assert(!w.rows.some(r=>r.id==='mince'&&r.purchase>0));
 assert.equal(w.rows.find(r=>r.id==='lemon').purchase,200);assert.equal(w.rows.find(r=>r.id==='cheese').purchase,180);
 assert.equal(w.rows.find(r=>r.id==='sourcream').purchase,360);
});
test('recipe quantities, no banned foods, frozen reserves and hearty breakfasts preserved',()=>{
 assert.equal(mealEntries(6).length,9);
 for(const {id,slot} of mealEntries(6)){
  const r=recipeFor(id);assert.equal(r.portions,[4,5,7,8].includes(slot)?2:3);
  for(const bad of ['sauerkraut','peking','cabbage','apple','bacon','ham'])assert.equal(r.items[bad],undefined,id);
  assert.equal(r.items.readycutlets,undefined);assert.equal(r.items.peas,undefined);
 }
 assert.equal(recipeFor('o11thu').items.pork,330);assert.equal(recipeFor('o11thu').items.rice,150);assert.equal(recipeFor('o11thu').items.buckwheat,undefined);
 assert.equal(recipeFor('o11mon').items.bulgur,120);assert.equal(recipeFor('o11wed').items.bulgur,120);
 assert.equal(recipeFor('o11satB').items.curd,400);assert.equal(recipeFor('o11sunB').items.curd,350);
 assert.equal(currentIngredient('pickles',6).pack,240);assert.equal(currentIngredient('pickles',6).price,189.99);
});
test('public sources contain sanitized receipt, no fiscal identifiers or private file paths',async()=>{
 const text=await readFile(new URL('../plan-source/week-eleven.mjs',import.meta.url),'utf8');
 for(const bad of ['@yandex','receipt.taxcom','№ ФН','№ ФД','C:/Users','C:\\Users'])assert(!text.includes(bad),bad);
});
