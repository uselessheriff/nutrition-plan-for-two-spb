import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {calculate,recipeFor,mealEntries} from '../plan-source/model.mjs';
import {weekTenStock,weekNinePurchases,weekNineExtras,weekNineReportedTotal} from '../plan-source/week-ten.mjs';

test('receipt, reported extras and future forecast remain distinct',()=>{
 const p=calculate(1);
 assert.equal(Math.round(weekNinePurchases.reduce((s,r)=>s+r.amount,0)*100)/100,3180.39);
 assert.equal(weekNinePurchases.length,24);
 assert.equal(weekNineExtras.length,1);assert.equal(weekNineExtras[0].amount,600);
 assert(weekNinePurchases.every(r=>r.date==='03.10.2026'&&r.period==='w4'));
 assert.equal(p.weeks[4].total,weekNineReportedTotal);assert.equal(p.currentCycleConfirmed,8650.03);
 assert.equal(p.confirmed,16726.64);
 assert.equal(p.total,Math.round((8650.03+p.remainingTotal)*100)/100);
 assert(p.total<25000);assert(p.weeks[5].isActual);assert(p.weeks.slice(6).every(w=>!w.isActual));
});
test('new inventory replaces projected stock; quantities are conserved',()=>{
 const p=calculate(1),w=p.weeks[5];
 for(const r of w.rows){
  if(r.opening===null)continue;
  assert.equal(r.opening,weekTenStock[r.id]||0,r.id);
  assert.equal(r.opening+r.purchase-r.used,r.closing,r.id);
  assert(r.closing>=0,r.id);
 }
 for(const id of ['creamcheese','egg','pepper','tomato','broccoli','porkbones','pasta','couscous','oats','flour'])assert.equal(w.rows.find(r=>r.id===id).purchase,0,id);
 assert.equal(w.remaining.readycutlets,200);
 assert.equal(w.rows.find(r=>r.id==='potato').purchase,700);
 assert.equal(w.rows.find(r=>r.id==='peas').purchase,800);
 assert.equal(w.rows.find(r=>r.id==='spices').cost,60);
 assert.equal(w.rows.find(r=>r.id==='lemon').purchase,200);
 const revised=calculate(1,{couscous:10,bulgur:20,rice:250});
 assert.deepEqual(revised.weeks[4],p.weeks[4]);
 assert.deepEqual(revised.weeks[5],p.weeks[5]);assert.equal(revised.weeks[6].remaining.couscous,10);
});
test('week10 has nine slots, intended portions, requested soup and bounded poultry',()=>{
 const entries=mealEntries(5);assert.equal(entries.length,9);
 for(const {id,slot} of entries)assert.equal(recipeFor(id).portions,[4,5,7,8].includes(slot)?2:3,id);
 const soup=recipeFor('o10thu');assert.equal(soup.items.porkbones,400);assert.equal(soup.items.peas,120);assert.equal(soup.items.pork,240);
 assert.equal(recipeFor('o10satD').items.pork,300);assert.equal(recipeFor('o10satD').items.pickles,120);
 for(const w of [5,6,7])for(const {id} of mealEntries(w))assert.equal(recipeFor(id).items.sauerkraut,undefined,id);
 assert.equal(entries.filter(({id})=>['Курица','Индейка'].includes(recipeFor(id).protein)).length,2);
});
