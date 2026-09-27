import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {calculate,recipeFor,mealEntries,calories} from '../plan-source/model.mjs';
import {weekEightStock,weekSevenPurchases,weekSevenExtras,weekSevenActual,confirmedThroughSeven} from '../plan-source/week-eight.mjs';
test('week8 replaces every projected pantry with latest quantities; unopened stock is not invented',()=>{
 const w=calculate().weeks[3],row=id=>w.rows.find(r=>r.id===id);
 for(const[id,q]of Object.entries(weekEightStock))if(row(id))assert.equal(row(id).opening,q,id);
 for(const id of ['chicken','pork','mince','egg','puffdough','fish','oil'])assert.equal(row(id).opening,0,id);
 for(const id of ['pasta','rice','buckwheat','semolina','flour','carrot','zucchini'])assert.equal(row(id).purchase,0,id);
 assert(!row('feta'));assert(!row('jam'));assert.equal(row('mustard').opening,null);
 assert.equal(row('oil').used,81);assert.equal(row('bulgur').opening,60);
 assert.equal(calculate(1,{rice:180}).weeks[3].rows.find(r=>r.id==='rice').opening,180);
 assert.equal(calculate(1,{rice:180}).weeks[2].rows.find(r=>r.id==='rice').opening,300,'past week never uses new UI override');
});
test('one four-portion pie spans Saturday dinner and Sunday breakfast without doubled purchases',()=>{
 const pie=recipeFor('w4turkey'),next=recipeFor('w4millet'),w=calculate().weeks[3];
 assert.equal(pie.portions,4);assert.equal(next.portions,2);assert.equal(next.carryoverFrom,pie.id);
 for(const[id,q]of Object.entries(pie.items))assert.equal(next.items[id],q/2);
 for(const id of ['fish','puffdough','creamcheese']){const row=w.rows.find(r=>r.id===id);assert.equal(row.used,pie.items[id]);assert.equal(row.alloc.length,1);}
 assert.equal(calories(pie),calories(next));assert.equal(w.rows.find(r=>r.id==='fish').purchase,800);
 assert.equal(mealEntries(3).length,9);assert.equal(mealEntries(3).filter(x=>!recipeFor(x.id).carryoverFrom).length,8);
 assert.match(recipeFor('w4curd').title,/Сырники/);assert.equal(recipeFor('w4curd').portions,2);
 for(const {id,slot}of mealEntries(3)){const r=recipeFor(id);assert.equal(r.steps.length,4);if(![5,8].includes(slot)){assert(r.yieldPerPortion[1]<=450);assert.equal(r.portions,slot===7?4:slot===4?2:3);}}
 assert.equal(mealEntries(3).filter(x=>recipeFor(x.id).protein==='Курица').length,2);
});
test('receipt and reported extras are counted once, past forecasts never become payments',()=>{
 assert.equal(weekSevenPurchases.length,14);
 assert.equal(Math.round(weekSevenPurchases.reduce((s,x)=>s+x.amount,0)*100),236656);
 assert.equal(weekSevenExtras.reduce((s,x)=>s+x.amount,0),280);
 assert.equal(weekSevenActual,2646.56);assert.equal(confirmedThroughSeven,10653.02);
 const p=calculate();assert.equal(p.confirmed,10653.02);assert.equal(p.weeks[2].total,2845,'historical forecast unchanged');
 assert.equal(p.remainingTotal,5910.5);assert.equal(p.total,16563.52);assert(p.total<25000);
 assert.equal(p.weeks[3].delivery,0);assert.equal(p.weeks[3].base,0);assert.equal(p.weeks[3].buffer,282);
 for(const r of p.weeks[3].rows)if(r.opening!==null){assert.equal(r.opening+r.purchase-r.used,r.closing);assert(r.closing>=0);}
});
test('Wednesday replacement buys turkey and only the couscous deficit; removes tuna and one passata pack',()=>{
 const r=recipeFor('w4pork'),w=calculate().weeks[3],row=id=>w.rows.find(x=>x.id===id);
 assert.match(r.title,/Индейка в сметанном соусе/);assert.equal(r.portions,3);assert.equal(calories(r),544);
 assert.deepEqual(r.items,{turkey:410,couscous:180,zucchini:200,onion:60,sourcream:100,oil:12,salt:3,spices:1});
 assert(!row('tuna'));assert.equal(row('turkey').purchase,410);assert.equal(row('couscous').opening,60);assert.equal(row('couscous').used,180);assert.equal(row('couscous').purchase,450);
 assert.equal(row('passata').purchase,500);assert.equal(row('cheese').purchase,180);assert.equal(row('sourcream').purchase,300);assert.equal(row('pasta').purchase,0);
});
