import test from 'node:test';
import assert from 'node:assert/strict';
import '../plan-source/recipes.mjs';
import {calculate,mealEntries,recipeFor,calories} from '../plan-source/model.mjs';
import {weekSevenStock,additionalConfirmed,cycleConfirmed} from '../plan-source/week-seven.mjs';
test('new pantry resets week7, including semolina and both pasta lots',()=>{
 const p=calculate(),w=p.weeks[2],row=id=>w.rows.find(r=>r.id===id);
 for(const[id,n]of Object.entries(weekSevenStock))if(row(id))assert.equal(row(id).opening,n,id);
 for(const id of ['chicken','pork','pasta','rice','buckwheat','semolina','egg','broccoli','mushrooms','passata','butter','carrot','flour'])assert.equal(row(id).purchase,0,id);
 assert.equal(row('semolina').closing,330);assert.equal(row('pasta').closing,680);
 assert.equal(row('pork').used,1000);assert.equal(row('chicken').used,550);
 assert.equal(p.weeks[3].rows.find(r=>r.id==='pasta').opening,750,'new week8 report supersedes projected carryover');
 assert.equal(row('jam').opening,null,'jam present but total weight unmeasured');
});
test('seven moderate dinner batches and unchanged hearty breakfasts',()=>{
 const meals=mealEntries(2).map(({id,slot})=>({r:recipeFor(id),slot}));
 assert.equal(meals.length,9);
 for(const{r,slot}of meals){assert.equal(r.steps.length,4);assert(calories(r)>0);if([5,8].includes(slot)){assert.equal(r.portions,2);assert.equal(r.yieldPerPortion,undefined);}else{assert.equal(r.portions,[4,7].includes(slot)?2:3);assert(r.yieldPerPortion[1]<=450);assert.match(r.note,/оценка/);}}
 assert.equal(meals.filter(x=>x.r.protein==='Курица').length,1);
 assert.deepEqual(recipeFor('w3pancake').items,{flour:120,egg:2,banana:200,milk:150,oil:10,yogurt:250,curd:180,jam:30,salt:.5});
});
test('current known payments are counted once without adding past-week forecast',()=>{
 const p=calculate();assert.equal(cycleConfirmed,3331.30+4175.16+500);
 assert.equal(additionalConfirmed.length,2);assert.equal(additionalConfirmed[0].period,'unassigned');
 assert.equal(p.total,Math.round((cycleConfirmed+2646.56+p.weeks[3].total)*100)/100);assert(p.total<25000);
 assert.equal(p.weeks[1].total,4545,'previous forecast preserved, not added to payments');
 for(const w of p.weeks.slice(2))for(const r of w.rows)if(r.opening!==null){assert.equal(r.opening+r.purchase-r.used,r.closing);assert(r.closing>=0);}
});
