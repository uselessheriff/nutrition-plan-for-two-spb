import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import './recipes.mjs';
import {recipes,ingredients,weeks,tiers,calculate,recipeFor,calories,extras} from './model.mjs';
assert.equal(recipes.length,44);
assert.equal(new Set(recipes.map(r=>r.id)).size,44);
assert.equal(weeks.flatMap(w=>w.ids).length,44);
for(let tier=0;tier<3;tier++) {
 const p=calculate(tier);
 assert(p.total<=tiers[tier].cap,`Budget exceeded: ${tier} ${p.total}`);
 assert.equal(p.total,p.weeks.reduce((s,w)=>s+w.total,0));
 for(const week of p.weeks)for(const row of week.rows){assert(row.cost>=0);assert(row.used>0);assert.equal(row.used,row.alloc.reduce((s,a)=>s+a[1],0));if(!ingredients[row.id].base){assert(row.closing>=0);assert.equal(row.opening+row.purchase-row.used,row.closing);assert(Math.abs(row.purchase/ingredients[row.id].pack-Math.round(row.purchase/ingredients[row.id].pack))<1e-7);}}
 for(const w of weeks){assert(w.ids.filter(id=>recipeFor(id,tier).protein==='Курица').length<=2);for(const id of w.ids){const r=recipeFor(id,tier);assert(r.steps.length>=4);assert(calories(r)>=300&&calories(r)<=1100);for(const [key,q]of Object.entries(r.items)){assert(ingredients[key],key);assert(Number.isFinite(q)&&q>0,`${id} ${key}`);}}}
 const first=p.weeks[0];for(const id of ['egg','chicken','yogurt','cheese','feta','cucumber','tomato','eggplant','spinach','broccoli','marinated','pickles','pasta']) {const r=first.rows.find(r=>r.id===id);assert.equal(r.opening,ingredients[id].stock);assert.equal(r.purchase,tier===2&&id==='yogurt'?500:0,`${id} purchase mismatch in week1`);assert.equal(r.closing,0,`${id} should be allocated in week1`);}
 const withStock=calculate(tier,{rice:640,bulgur:400,couscous:80});assert(withStock.total<=p.total);
 for(const e of extras(tier,0))for(const id of Object.keys(e.items))assert(ingredients[id]);
}
const shrimp=recipeFor('w3shrimp',1);assert.equal(shrimp.items.couscous,100);assert.equal(shrimp.items.shrimp,350);
assert.equal(recipeFor('w3shrimp',0).items.shrimp,undefined);
assert.equal(recipeFor('w4fish',2).items.salmon,400);
const html=await readFile(new URL('../public/nutrition-plan.html',import.meta.url),'utf8');
assert(html.includes('name="viewport"'));assert(html.includes('@media(max-width:440px)'));
assert(!html.includes('В карточке выберите 3 порции'));
assert(!html.includes('Картофельно-творожная запеканка'));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate DOM IDs');
function harness(initialStorage={}){
 const nodes=new Map();
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',style:{},events:{},dataset:{},open:false,elements:{namedItem:n=>node(id+':'+n)},addEventListener(k,f){this.events[k]=f;},showModal(){this.open=true;},close(){this.open=false;},focus(){},setAttribute(){},removeAttribute(){},append(){},click(){},remove(){}});return nodes.get(id);}
 ids.forEach(node);node('expense-period').value='review';const storage=new Map(Object.entries(initialStorage));
 const context=vm.createContext({console,Intl,Date,Number,Object,Array,Math,JSON,String,Error,URL,Blob,setTimeout:()=>0,document:{getElementById:node,body:node('body'),createElement:()=>node('a')},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{print(){}}});
 vm.runInContext(script,context);return{nodes,context,storage,node};
}
const h=harness();assert.equal(vm.runInContext('seed.reduce((s,x)=>s+x.amount,0)',h.context),5075.51);
for(const tier of [1])for(let week=0;week<4;week++) {vm.runInContext(`activeWeek=${week};render()`,h.context);assert.equal((h.node('meal-list').innerHTML.match(/data-recipe=/g)||[]).length,11);for(const id of weeks[week].ids){vm.runInContext(`openRecipe('${id}',null)`,h.context);assert(h.node('recipe-dialog').open);assert(h.node('recipe-title').textContent);assert.equal((h.node('recipe-ingredients').innerHTML.match(/<li>/g)||[]).length,Object.keys(recipeFor(id,tier).items).length);assert.equal((h.node('recipe-steps').innerHTML.match(/<li>/g)||[]).length,4);vm.runInContext('closeRecipe()',h.context);assert(!h.node('recipe-dialog').open);}}
for(const id of ['rice','bulgur','couscous'])h.node('grain-form:'+id).value=id==='rice'?'640':'';
h.node('grain-form').events.submit({preventDefault(){},target:h.node('grain-form')});assert(h.storage.get('petersburg-ration-september-2026-v2').includes('640'));
h.node('expense-form:name').value='<img src=x onerror=alert(1)>';
h.node('expense-form:amount').value='123.45';h.node('expense-form:date').value='2026-09-07';h.node('expense-period').value='w0';
h.node('expense-form').events.submit({preventDefault(){},target:h.node('expense-form')});assert(h.node('expense-list').innerHTML.includes('&lt;img'));assert(!h.node('expense-list').innerHTML.includes('<img'));assert(h.node('expense-summary').innerHTML.includes('123,45'));
const legacy='{"entries":[{"name":"old","amount":100}]}';const h2=harness({'petersburg-ration-actual-week-expenses-v1':legacy});assert.equal(h2.storage.get('petersburg-ration-actual-week-expenses-v1'),legacy);assert(h2.node('legacy-note').innerHTML.includes('старый журнал'));
console.log('PASS: 44 recipes, 132 variants, 12 weekly menus, budgets, package rounding, inventory conservation, first-week pantry, modal rendering, forms, XSS escaping, legacy preservation.');
console.log(JSON.stringify(tiers.map((t,i)=>({limit:t.cap,total:calculate(i).total,weeks:calculate(i).weeks.map(w=>w.total)}))));
assert.equal((h.node('shopping-weeks').innerHTML.match(/class="shopping-week surface"/g)||[]).length,4);
for(let index=0;index<4;index++){
 const rendered=h.node('shopping-weeks').innerHTML.split('data-shopping-week="'+index+'"')[1].split('</details></div></details>')[0];
 assert(rendered.includes('Что купить на неделю '+(index+5)));
 assert(rendered.indexOf('class="buy-list"')<rendered.indexOf('Подробный расчёт'));
 const expected=calculate(1,{rice:640}).weeks[index].rows.filter(r=>r.purchase>0);
 assert.equal((rendered.match(/data-buy-product=/g)||[]).length,expected.length);
 for(const row of expected)assert(rendered.includes('data-buy-product="'+row.id+'"'));
}
h.node('shopping-weeks').events.toggle({target:{dataset:{shoppingWeek:'2'},open:true}});
vm.runInContext('renderShopping()',h.context);
assert.match(h.node('shopping-weeks').innerHTML,/data-shopping-week="2" open/);
vm.runInContext('download=(name,data,type)=>{globalThis.exported={name,data,type}};downloadShopping(2)',h.context);
assert.equal(vm.runInContext('exported.name',h.context),'zakupka-nedelya-7-25000.csv');
assert(!html.includes('id="budget-switch"'));
assert(!html.includes('id="journal"'));
assert(!html.includes('id="price-analysis"'));
console.log('PASS: 4 weekly purchase disclosures, purchase-only lists, fixed 25k, CSV week 7, hidden methodology removed');
