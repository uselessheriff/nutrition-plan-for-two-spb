import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import './recipes.mjs';
import {recipes,ingredients,weeks,tiers,calculate,recipeFor,calories,extras,mealEntries} from './model.mjs';
assert.equal(recipes.length,44);
assert.equal(new Set(recipes.map(r=>r.id)).size,44);
assert.equal(weeks.flatMap(w=>w.ids).length,44);
for(let tier=0;tier<3;tier++) {
 const p=calculate(tier,{},true);
 assert(p.total<=tiers[tier].cap,`Budget exceeded: ${tier} ${p.total}`);
 assert.equal(p.total,p.weeks.reduce((s,w)=>s+w.total,0));
 for(const week of p.weeks)for(const row of week.rows){assert(row.cost>=0);assert(row.used>0);assert.equal(row.used,row.alloc.reduce((s,a)=>s+a[1],0));if(!ingredients[row.id].base){assert(row.closing>=0);assert.equal(row.opening+row.purchase-row.used,row.closing);assert(Math.abs(row.purchase/ingredients[row.id].pack-Math.round(row.purchase/ingredients[row.id].pack))<1e-7);}}
 for(const w of weeks){assert(w.ids.filter(id=>recipeFor(id,tier,true).protein==='Курица').length<=2);for(const id of w.ids){const r=recipeFor(id,tier,true);assert(r.steps.length>=4);assert(calories(r)>=300&&calories(r)<=1100);for(const [key,q]of Object.entries(r.items)){assert(ingredients[key],key);assert(Number.isFinite(q)&&q>0,`${id} ${key}`);}}}
 const first=p.weeks[0];for(const id of ['egg','chicken','yogurt','cheese','feta','cucumber','tomato','eggplant','spinach','broccoli','marinated','pickles','pasta']) {const r=first.rows.find(r=>r.id===id);assert.equal(r.opening,ingredients[id].stock);if(tier!==1){assert.equal(r.purchase,tier===2&&id==='yogurt'?500:0,`${id} purchase mismatch in week1`);assert.equal(r.closing,0,`${id} should be allocated in week1`);}}
 const withStock=calculate(tier,{rice:640,bulgur:400,couscous:80},true);assert(withStock.total<=p.total);
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
const h=harness();assert.equal(vm.runInContext('seed.filter(x=>x.period==="review").reduce((s,x)=>s+x.amount,0)',h.context),5075.51);
for(const tier of [1])for(let week=0;week<4;week++) {vm.runInContext(`activeWeek=${week};render()`,h.context);assert.equal((h.node('meal-list').innerHTML.match(/data-recipe=/g)||[]).length,week===0?11:9);for(const {id} of mealEntries(week)){vm.runInContext(`openRecipe('${id}',null)`,h.context);assert(h.node('recipe-dialog').open);assert(h.node('recipe-title').textContent);assert.equal((h.node('recipe-ingredients').innerHTML.match(/<li>/g)||[]).length,Object.keys(recipeFor(id,tier).items).length);assert.equal((h.node('recipe-steps').innerHTML.match(/<li>/g)||[]).length,4);vm.runInContext('closeRecipe()',h.context);assert(!h.node('recipe-dialog').open);}}
for(const id of ['rice','bulgur','couscous'])h.node('grain-form:'+id).value=id==='rice'?'640':'';
h.node('grain-form').events.submit({preventDefault(){},target:h.node('grain-form')});assert(h.storage.get('petersburg-ration-september-2026-v2').includes('640'));
h.node('expense-form:name').value='<img src=x onerror=alert(1)>';
h.node('expense-form:amount').value='123.45';h.node('expense-form:date').value='2026-09-07';h.node('expense-period').value='w0';
h.node('expense-form').events.submit({preventDefault(){},target:h.node('expense-form')});assert(h.node('expense-list').innerHTML.includes('&lt;img'));assert(!h.node('expense-list').innerHTML.includes('<img'));assert(h.node('expense-list').innerHTML.includes('123,45'));
const legacy='{"entries":[{"name":"old","amount":100}]}';const h2=harness({'petersburg-ration-actual-week-expenses-v1':legacy});assert.equal(h2.storage.get('petersburg-ration-actual-week-expenses-v1'),legacy);assert(h2.node('legacy-note').innerHTML.includes('старый журнал'));
console.log('PASS: 44 recipes, 132 variants, 12 weekly menus, budgets, package rounding, inventory conservation, first-week pantry, modal rendering, forms, XSS escaping, legacy preservation.');
console.log(JSON.stringify(tiers.map((t,i)=>({limit:t.cap,total:calculate(i).total,weeks:calculate(i).weeks.map(w=>w.total)}))));
assert.equal((h.node('shopping-weeks').innerHTML.match(/class="shopping-week surface"/g)||[]).length,4);
for(let index=1;index<4;index++){
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

// Primary mobile rows show purchase deficit, not the total recipe requirement.
const mobile=harness();
for(let index=1;index<4;index++){
 const list=mobile.node('shopping-weeks').innerHTML.split('data-shopping-week="'+index+'"')[1].split('<div class="shopping-actions">')[0];
 assert.match(list,/<span>Продукт<\/span><span>Купить<\/span><span>Цена<\/span>/);
 for(const row of calculate(1).weeks[index].rows.filter(r=>r.purchase>0)){
  const item=list.split('data-buy-product="'+row.id+'"')[1].split('</li>')[0];
  assert(item.indexOf('class="buy-product"')<item.indexOf('class="buy-quantity"'));
  assert(item.indexOf('class="buy-quantity"')<item.indexOf('class="buy-price"'));
  const expectedQuantity=vm.runInContext(`qty('${row.id}',${row.purchase})`,mobile.context);
  const expectedPrice=vm.runInContext(`money(${row.cost})`,mobile.context);
  assert(item.split('class="buy-quantity"')[1].split('</div>')[0].includes(expectedQuantity));
  assert(item.split('class="buy-price"')[1].split('</div>')[0].includes(expectedPrice));
  assert(!item.includes('Фасовка'));
 }
}
const fillet=calculate(1,{},true).weeks[0].rows.find(r=>r.id==='chicken');
assert.equal(fillet.used,1140);assert.equal(fillet.opening,760);assert.equal(fillet.purchase,400);
const grainRow=mobile.node('shopping-weeks').innerHTML.split('data-buy-product="rice"')[1].split('</li>')[0];
assert(grainRow.includes('по правилу ≈ 60 г на пакетик'));
assert(grainRow.indexOf('buy-warning')>grainRow.indexOf('buy-price'));
const known=harness({'petersburg-ration-september-2026-v2':JSON.stringify({grains:{rice:640},grainSnapshot:'2026-09-13',entries:[]})});
assert(!known.node('shopping-weeks').innerHTML.split('data-shopping-week="1"')[1].split('<div class="shopping-actions">')[0].includes('data-buy-product="rice"'));
const css=await readFile(new URL('style.css',import.meta.url),'utf8');
const oldGrains=harness({'petersburg-ration-september-2026-v2':JSON.stringify({grains:{rice:640},entries:[]})});
assert.equal(vm.runInContext('saved.previousGrains.rice',oldGrains.context),640);
assert.equal(vm.runInContext('plan().weeks[1].rows.find(r=>r.id==="rice").opening',oldGrains.context),300);
assert.equal(vm.runInContext('plan().weeks[1].rows.find(r=>r.id==="rice").opening',known.context),640);
assert(mobile.node('shopping-weeks').innerHTML.split('data-shopping-week="0"')[1].includes('Не повторять закупку'));
assert.equal(vm.runInContext('seed.filter(x=>x.period==="w0").reduce((s,x)=>s+x.amount,0).toFixed(2)',mobile.context),'3331.30');
assert(css.includes('grid-template-columns:minmax(0,1.4fr) minmax(0,.8fr) minmax(0,.8fr)'));
assert(css.includes('.buy-list strong {font-size:1rem'));
assert(!css.includes('.buy-list li > div:last-child'));
console.log('PASS: product-buy-price reading order, pantry-adjusted buy quantities, exact row prices, grain warnings and responsive CSS guardrails');

// Department groups preserve every net purchase once, including downloadable lists.
for(let week=1;week<4;week++){
 const groups=vm.runInContext(`groupShoppingRows(plan().weeks[${week}].rows,id=>currentIngredient(id).name)`,mobile.context);
 const markup=mobile.node('shopping-weeks').innerHTML.split('data-shopping-week="'+week+'"')[1].split('<div class="shopping-actions">')[0];
 assert.equal((markup.match(/data-buy-department=/g)||[]).length,groups.length);
 for(const group of groups){
  const section=markup.split('data-buy-department="'+group.id+'"')[1].split('</section>')[0];
  assert(section.includes(group.label));assert(!section.includes('<details'));
  for(const row of group.rows)assert.equal((section.match(new RegExp('data-buy-product="'+row.id+'"','g'))||[]).length,1);
 }
 vm.runInContext(`download=(name,data,type)=>{globalThis.exported={name,data,type}};downloadShopping(${week})`,mobile.context);
 const csv=vm.runInContext('exported.data',mobile.context);
 assert(csv.includes('"Продукт";"Купить";"Плановая стоимость ₽";"Отдел"'));
 for(const group of groups)for(const row of group.rows)assert(csv.includes('"'+group.label+'"'));
 assert(!csv.includes('"Горчица"'));assert(!csv.includes('"Варенье морошки"'));
}
console.log('PASS: department headings, unique net purchases, no nested category toggles, grouped CSV');
