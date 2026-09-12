import assert from 'node:assert/strict';
import test from 'node:test';
import '../plan-source/recipes.mjs';
import {ingredients,calculate,currentIngredient} from '../plan-source/model.mjs';
import {shoppingDepartments,shoppingDepartment,groupShoppingRows} from '../plan-source/shopping-departments.mjs';

test('every known ingredient belongs to exactly one store department',()=>{
 const assigned=shoppingDepartments.flatMap(g=>g.products);
 assert.equal(new Set(assigned).size,assigned.length);
 assert.deepEqual([...assigned].sort(),Object.keys(ingredients).sort());
 assert.equal(shoppingDepartment('tuna').id,'canned');
 assert.equal(shoppingDepartment('bar').id,'dairy');
 assert.equal(shoppingDepartment('mushrooms').id,'produce');
 assert.equal(shoppingDepartment('broccoli').id,'frozen');
 assert.equal(shoppingDepartment('new-unmapped-product').id,'other');
});
test('departments preserve amounts, totals, pantry deductions and deterministic order',()=>{
 const p=calculate(),before=JSON.stringify(p);
 for(const w of p.weeks.slice(1)){
  const groups=groupShoppingRows(w.rows,id=>currentIngredient(id).name);
  const actual=groups.flatMap(g=>g.rows),expected=w.rows.filter(r=>r.purchase>0);
  assert.equal(new Set(actual.map(r=>r.id)).size,actual.length);
  assert.deepEqual(actual.map(r=>r.id).sort(),expected.map(r=>r.id).sort());
  assert.equal(groups.reduce((s,g)=>s+g.total,0),w.food);
  for(const g of groups)assert(g.rows.length>0);
  assert.deepEqual(groups,groupShoppingRows([...w.rows].reverse(),id=>currentIngredient(id).name));
  assert(!actual.some(r=>['mustard','jam'].includes(r.id)));
 }
 assert.equal(JSON.stringify(p),before);
 assert.deepEqual(groupShoppingRows([{id:'egg',purchase:0,cost:0}]),[]);
 assert.deepEqual(p.weeks.map(w=>w.total),[3331.3,4545,4069,5766]);
});
