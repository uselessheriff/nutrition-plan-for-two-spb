import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {recipeFor as currentRecipeFor,recipes,weeks,calculate as currentCalculate,calories,extras,ingredients} from '../plan-source/model.mjs';
import {mixedMinceIds,porkInsteadOfTurkeyIds} from '../plan-source/active-plan.mjs';
const recipeFor=id=>currentRecipeFor(id,1,true);
const calculate=()=>currentCalculate(1,{},true);
// Preserve the previously published 06.09 plan as a regression snapshot.
test('archived 06.09 plan keeps full dinner and next-day lunch portions without double counting',()=>{
 for(let w=0;w<4;w++) {
  const needs={};
  for(let slot=0;slot<11;slot++) {
   const r=recipeFor(weeks[w].ids[slot]);
   assert.equal(r.portions,[0,1,2,3,10].includes(slot)?3:2);
   if(r.portions===3){assert.match(r.note,/третью отложите/);assert.doesNotMatch(r.steps.join(' '),/две тарелки|2 порции|разделите пополам/i);}
   for(const [id,q]of Object.entries(r.items))needs[id]=(needs[id]||0)+q;
  }
  for(const e of extras(1,w,true))for(const [id,q]of Object.entries(e.items))needs[id]=(needs[id]||0)+q;
  const result=calculate(1).weeks[w];
  assert.deepEqual(Object.fromEntries(result.rows.map(r=>[r.id,r.used])),needs);
  for(const r of result.rows)if(!ingredients[r.id].base)assert.equal(r.opening+r.purchase-r.used,r.closing);
 }
});
test('approved substitutions preserve meat weight, beef bolognese and seafood',()=>{
 for(const id of mixedMinceIds){const r=recipeFor(id);assert.equal(r.items.mixedmince/r.portions,200);assert(!r.items.mince);assert.match(r.steps.join(' '),/смешанного фарша/);}
 for(const id of porkInsteadOfTurkeyIds){const r=recipeFor(id);assert.equal(r.items.pork/r.portions,205);assert(!r.items.turkey);assert(!r.title.includes('Индейка'));assert(!r.steps.join(' ').includes('индей'));}
 assert.equal(recipeFor('w1bolognese').items.mince,400);
 assert.equal(recipeFor('w3pilaf').items.pork,600);
 assert.equal(recipeFor('w3shrimp').items.couscous,100);
 assert.equal(recipeFor('w3shrimp').items.shrimp,350);
 assert.equal(recipeFor('w2tuna').items.tuna,3);
 assert.equal(recipeFor('w4fish').items.fish,600);
});
test('Sunday week5 mash and whole eggs agree across ingredients, steps and calorie denominator',()=>{
 const r=recipeFor('w1pork');assert(!r.items.bulgur);assert.match(r.title,/пюре/);
 assert.equal(r.items.pork,600);assert.equal(r.items.potato,750);assert.equal(r.items.milk,150);assert.equal(r.items.butter,22.5);assert.equal(calories(r),793);
 const c=recipeFor('w3chicken');assert.equal(c.items.egg,2);assert.match(c.steps[0],/2 яйцами/);assert.equal(calories(c),719);
 for(const id of ['w1chicken','w1eggplant','w1tortilla','w1pasta','w2liver','w2tuna','w2pork','w2chicken','w3pork','w3pasta','w4chicken','w4fish','w4pork']){
  const base=recipes.find(r=>r.id===id),active=recipeFor(id);
  for(const [key,q]of Object.entries(base.items))assert.equal(active.items[key]/active.portions,q/2);
  assert.equal(calories(active),calories({...base,portions:2}));
 }
});
test('25k self-shopping forecast includes packaging, base and 5% reserve, not historical expenses',()=>{
 const p=calculate(1);
 assert.equal(p.total,24693);assert.equal(p.food,22715);assert.deepEqual(p.weeks.map(w=>w.total),[5389,6492,6476,6336]);
 for(const w of p.weeks){assert.equal(w.delivery,0);assert.equal(w.bufferRate,.05);assert.equal(w.buffer,Math.ceil((w.food+w.base)*.05));}
 assert.equal(p.weeks[3].remaining.egg,3);
 for(const w of weeks){assert(w.ids.filter(id=>recipeFor(id).protein==='Курица').length<=2);assert(!w.ids.some(id=>/минтай|белокочанн|перловк/.test(recipeFor(id).title)));}
 for(const w of [2,3])assert.equal(weeks[w].ids.filter(id=>recipeFor(id).items.rice).length,1);
 assert.equal(extras(1,0)[0].items.apple,1000);assert.equal(extras(1,0)[1].items.juice,500);assert.equal(extras(1,0)[2].items.bar,2);
});
