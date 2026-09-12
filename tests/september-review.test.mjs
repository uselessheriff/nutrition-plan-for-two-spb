import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {recipeFor,calculate,weeks,extras,ingredients,currentIngredient,calories} from '../plan-source/model.mjs';
import {latestStock,weekFivePurchases,weekFiveActual,weekFiveMealUpdates} from '../plan-source/revision-september.mjs';

test('closing snapshot resets week6 rather than carrying consumed or spoiled week5 items',()=>{
 const w=calculate().weeks[1],row=id=>w.rows.find(r=>r.id===id);
 for(const [id,n]of Object.entries(latestStock))if(row(id))assert.equal(row(id).opening,n,id);
 for(const id of ['potato','onion','cucumber','pasta','milk','oil'])assert.equal(row(id).opening,0,id);
 for(const id of ['rice','bulgur','egg','feta','mince','butter','oats','millet'])assert.equal(row(id).purchase,0,id);
 assert.equal(row('rice').opening,300);assert.equal(row('bulgur').opening,180);
 assert.equal(row('chicken').used,600);assert.equal(row('chicken').opening,150);assert.equal(row('chicken').purchase,550);
 assert.equal(row('passata').used,1200);assert.equal(row('passata').opening,400);assert.equal(row('passata').purchase,1000);
 assert(!row('spinach'));assert.equal(calculate().weeks[3].rows.find(r=>r.id==='spinach').opening,0);
});
test('Monday has exactly two new portions for Anya; all other weekday lunch portions survive',()=>{
 for(let w=1;w<4;w++)for(let s=0;s<11;s++){
  const r=recipeFor(weeks[w].ids[s]);
  assert.equal(r.portions,w===1&&s===0?2:[0,1,2,3,10].includes(s)?3:2);
 }
 const r=recipeFor('w2turkey');assert.equal(r.items.pork,410);assert.equal(r.items.bulgur,140);
 assert.match(r.steps[3],/Ане на ужин понедельника/);assert.match(r.steps[3],/Обед понедельника у Ани и ужин парня/);
 assert(!r.items.potato);assert(!r.items.cabbage);assert.match(r.portionText,/ужин Пн \+ обед Вт/);
});
test('Sunday hot shrimp pasta is coherent and transfers only unthawed remaining shrimp',()=>{
 const r=recipeFor('w2pita');assert.match(r.title,/Горячая паста с креветками/);assert.equal(r.portions,2);
 assert.equal(r.items.pasta,160);assert.equal(r.items.shrimp,350);assert.equal(r.items.passata,300);
 assert(!r.items.pita&&!r.items.curd&&!r.items.spinach);assert.match(r.steps[3],/175 г креветок/);
 assert.equal(calories(r),570);assert.equal(calculate().weeks[1].remaining.shrimp,150);
 assert.equal(calculate().weeks[2].rows.find(r=>r.id==='shrimp').opening,150);
});
test('remaining beef is used once and no future Peking cabbage or oat pancakes remain',()=>{
 assert.equal(recipeFor('w2meatballs').items.mince,400);assert(!recipeFor('w2meatballs').items.mixedmince);
 assert.match(recipeFor('w2meatballs').steps[0],/говяжьего фарша из морозилки/);
 for(const w of weeks.slice(1))for(const id of w.ids){const r=recipeFor(id);assert(!r.items.cabbage,id);assert.doesNotMatch(r.title+' '+r.steps.join(' '),/пекинск/);}
 const r=recipeFor('w3pancake');assert.equal(r.items.flour,120);assert(!r.items.oats);assert.match(r.title,/Банановые панкейки/);
 assert.equal(recipeFor('w4cabbage').items.zucchini,600);
});
test('current budget separates week5 payments from remaining purchases, with explicit base and zero delivery',()=>{
 const p=calculate();assert.equal(p.confirmed,3331.3);assert.equal(p.remainingTotal,18130);assert.equal(p.total,21461.3);
 assert.deepEqual(p.weeks.map(w=>w.total),[3331.3,6332,5802,5996]);assert(p.total<=25000);
 for(let w=1;w<4;w++){
  const projected=p.weeks[w],needs={};
  for(const id of weeks[w].ids)for(const [i,n]of Object.entries(recipeFor(id).items))needs[i]=(needs[i]||0)+n;
  for(const e of extras(1,w))for(const [i,n]of Object.entries(e.items))needs[i]=(needs[i]||0)+n;
  assert.deepEqual(Object.fromEntries(projected.rows.map(r=>[r.id,r.used])),needs);
  for(const r of projected.rows)if(r.opening!==null){assert.equal(r.opening+r.purchase-r.used,r.closing);assert(r.closing>=0);assert.equal(r.cost,r.purchase/r.pack*r.unitPrice);}
  assert.equal(projected.delivery,0);assert.equal(projected.base,0);assert.equal(projected.buffer,Math.ceil(projected.food*.05));
  assert(!projected.rows.some(r=>/water|cutlet/.test(r.id)));
 }
 assert.equal(currentIngredient('milk').pack,1900);assert.equal(currentIngredient('curd').pack,180);
 assert.equal(ingredients.milk.pack,900,'historical assumptions preserved');
});
test('receipt foods and extras exactly once, with original menu outcomes not invented',()=>{
 assert.equal(Math.round(weekFivePurchases.reduce((s,r)=>s+r.amount,0)*100),333130);
 assert.equal(weekFivePurchases.filter(r=>r.name==='Вода').length,1);
 assert.equal(weekFivePurchases.filter(r=>r.name==='Котлеты Морозко').length,1);
 assert(!weekFivePurchases.some(r=>/Veiro|туалет/i.test(r.name)));
 assert.equal(weekFiveActual,3331.3);
 assert.deepEqual(Object.keys(weekFiveMealUpdates),['2','4','5']);
 assert(Object.values(weekFiveMealUpdates).every(x=>x.outcome==='not_eaten'));
 assert.match(weekFiveMealUpdates[5].note,/банановые панкейки/);
});
