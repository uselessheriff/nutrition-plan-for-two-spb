import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {recipeFor,calculate,weeks,extras,ingredients,currentIngredient,calories,mealEntries,slots} from '../plan-source/model.mjs';
import {deferredWeekendLunches,weekendPolicy} from '../plan-source/weekend-plan.mjs';
import {latestStock,weekFivePurchases,weekFiveActual,weekFiveMealUpdates} from '../plan-source/revision-september.mjs';

test('closing snapshot resets week6 rather than carrying consumed or spoiled week5 items',()=>{
 const w=calculate().weeks[1],row=id=>w.rows.find(r=>r.id===id);
 for(const [id,n]of Object.entries(latestStock))if(row(id))assert.equal(row(id).opening,n,id);
 for(const id of ['potato','onion','cucumber','pasta','milk','oil'])assert.equal(row(id).opening,0,id);
 for(const id of ['rice','bulgur','egg','feta','mince','butter','oats','millet'])assert.equal(row(id).purchase,0,id);
 assert.equal(row('rice').opening,300);assert.equal(row('bulgur').opening,180);
 assert.equal(row('chicken').used,600);assert.equal(row('chicken').opening,150);assert.equal(row('chicken').purchase,550);
 assert.equal(row('passata').used,900);assert.equal(row('passata').opening,400);assert.equal(row('passata').purchase,500);
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
test('deferred shrimp pasta remains in history but creates no purchase or fictional carryover',()=>{
 const r=recipeFor('w2pita');assert.match(r.title,/Горячая паста с креветками/);assert.equal(r.portions,2);
 assert.equal(r.items.pasta,160);assert.equal(r.items.shrimp,350);assert.equal(r.items.passata,300);
 assert(!r.items.pita&&!r.items.curd&&!r.items.spinach);assert.match(r.steps[3],/175 г креветок/);
 assert.equal(calories(r),570);
 for(const week of calculate().weeks.slice(1)){assert.equal(week.remaining.shrimp,0);assert(!week.rows.some(r=>r.id==='shrimp'));}
});
test('remaining beef is used once and no future Peking cabbage or oat pancakes remain',()=>{
 assert.equal(recipeFor('w2meatballs').items.mince,400);assert(!recipeFor('w2meatballs').items.mixedmince);
 assert.match(recipeFor('w2meatballs').steps[0],/говяжьего фарша из морозилки/);
 for(const w of weeks.slice(1))for(const id of w.ids){const r=recipeFor(id);assert(!r.items.cabbage,id);assert.doesNotMatch(r.title+' '+r.steps.join(' '),/пекинск/);}
 const r=recipeFor('w3pancake');assert.equal(r.items.flour,120);assert(!r.items.oats);assert.match(r.title,/Банановые панкейки/);
 assert.equal(recipeFor('w4cabbage').items.zucchini,600);
});
test('current budget separates week5 payments from remaining purchases, with explicit base and zero delivery',()=>{
 const p=calculate();assert.equal(p.confirmed,3331.3);assert.equal(p.remainingTotal,14380);assert.equal(p.total,17711.3);
 assert.deepEqual(p.weeks.map(w=>w.total),[3331.3,4545,4069,5766]);assert(p.total<=25000);
 for(let w=1;w<4;w++){
  const projected=p.weeks[w],needs={};
  for(const {id} of mealEntries(w))for(const [i,n]of Object.entries(recipeFor(id).items))needs[i]=(needs[i]||0)+n;
  for(const e of extras(1,w))for(const [i,n]of Object.entries(e.items))needs[i]=(needs[i]||0)+n;
  assert.deepEqual(Object.fromEntries(projected.rows.map(r=>[r.id,r.used])),needs);
  for(const r of projected.rows)if(r.opening!==null){assert.equal(r.opening+r.purchase-r.used,r.closing);assert(r.closing>=0);assert.equal(r.cost,r.purchase/r.pack*r.unitPrice);}
  assert.equal(projected.delivery,0);assert.equal(projected.base,0);assert.equal(projected.buffer,Math.ceil(projected.food*.05));
  assert(!projected.rows.some(r=>/water|cutlet/.test(r.id)));
 }
 assert.equal(currentIngredient('milk').pack,1900);assert.equal(currentIngredient('curd').pack,180);
 assert.equal(ingredients.milk.pack,900,'historical assumptions preserved');
});
test('future weekends have breakfast and dinner only with hearty breakfasts and preserved Sunday lunchbox',()=>{
 assert.equal(mealEntries(0).length,11,'week5 history preserved');
 for(let w=1;w<4;w++){
  const entries=mealEntries(w);assert.equal(entries.length,9);
  assert.deepEqual(entries.filter(x=>x.slot>=5).map(x=>slots[x.slot].slice(0,2)),[['Сб','Завтрак'],['Сб','Ужин'],['Вс','Завтрак'],['Вс','Ужин']]);
  for(const {id,slot}of entries){
   assert(!deferredWeekendLunches.includes(id));
   const r=recipeFor(id);
   if([5,8].includes(slot)){assert.equal(r.portions,2);assert(calories(r)>=650&&calories(r)<=900);assert.match(r.portionText,/плотный завтрак/);}
   if(slot===10)assert.equal(r.portions,3);
   if([4,7].includes(slot))assert.equal(r.portions,2);
  }
  assert.equal(extras(1,w).length,3);assert(!extras(1,w).some(e=>/выходных/.test(e.title)));
  assert.equal(mealEntries(w,1,true).length,11,'archived schedule still available');
  assert.equal(extras(1,w,true).length,4,'archived snack still available');
  assert(!calculate().weeks[w].rows.flatMap(r=>r.alloc).some(([label])=>/^(Сб|Вс) Обед|Перекус выходных/.test(label)));
 }
 assert.match(weekendPolicy,/Пт и Сб: ужин на 2/);
 assert.equal(recipeFor('w2eggs').items.feta,200);
 assert.equal(recipeFor('w3pancake').items.curd,180);
});
test('week6 Saturday replaces only the curd side with cheese toasts and recalculates packages',()=>{
 const r=recipeFor('w2millet'),p=calculate();
 assert(!r.items.curd);assert.equal(r.items.bread,100);assert.equal(r.items.cheese,60);
 assert.deepEqual([r.items.millet,r.items.milk,r.items.apple,r.items.butter,r.items.jam,r.items.salt],[150,500,300,15,30,.5]);
 assert.equal(r.portions,2);assert.equal(calories(r),804);assert.match(r.title,/тосты с сыром/);
 assert.match(r.steps[3],/100 г хлеба/);assert.match(r.steps[3],/60 г тёртого/);assert.match(r.steps[3],/50 г хлеба и 30 г сыра/);
 assert(!p.weeks[1].rows.some(x=>x.id==='curd'));
 const bread=p.weeks[1].rows.find(x=>x.id==='bread'),cheese=p.weeks[1].rows.find(x=>x.id==='cheese');
 assert.deepEqual([bread.used,bread.purchase,bread.cost,bread.closing],[480,800,180,320]);
 assert.deepEqual([cheese.used,cheese.purchase,cheese.cost,cheese.closing],[220,400,360,180]);
 assert.equal(p.weeks[2].rows.find(x=>x.id==='cheese').purchase,0);
 assert.equal(recipeFor('w3pancake').items.curd,180,'not a blanket ban on curd');
 assert.equal(recipeFor('w3oats').items.curd,360);assert.equal(recipeFor('w4millet').items.curd,360);
 assert.equal(recipeFor('w2millet',1,true).items.curd,200,'older recipe retained');
});
test('reported mustard and cloudberry jam cover weeks6–8 without repeated purchases',()=>{
 const p=calculate(),mustard=p.weeks.slice(1).map(w=>w.rows.find(r=>r.id==='mustard')),jam=p.weeks.slice(1).map(w=>w.rows.find(r=>r.id==='jam'));
 assert.equal(latestStock.mustard,80);assert.equal(latestStock.jam,380);
 assert.deepEqual(mustard.map(r=>[r.opening,r.used,r.closing]),[[80,45,35],[35,10,25],[25,15,10]]);
 assert.deepEqual(jam.map(r=>[r.opening,r.used,r.closing]),[[380,30,350],[350,30,320],[320,60,260]]);
 for(const r of [...mustard,...jam]){assert.equal(r.purchase,0);assert.equal(r.cost,0);}
 assert.equal(currentIngredient('jam').name,'Варенье морошки');
 assert.equal(recipeFor('w2millet').items.jam,30);assert.equal(recipeFor('w2chicken').items.mustard,30);
 assert.equal(calculate(1,{},true).total,24693,'historical plan unaffected');
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
