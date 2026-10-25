import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {novemberWeeks,novemberPrices,novemberOpeningStock,novemberExtras,calculateNovember} from '../plan-source/november-plan.mjs';

test('four November weeks contain 24 dinners for three and 12 meals for two',()=>{
 assert.deepEqual(novemberWeeks.map(w=>[w.number,w.start,w.end]),[[13,'2026-11-02','2026-11-08'],[14,'2026-11-09','2026-11-15'],[15,'2026-11-16','2026-11-22'],[16,'2026-11-23','2026-11-29']]);
 for(const w of novemberWeeks){
  assert.equal(w.meals.length,9);
  assert.deepEqual(w.meals.map(m=>m.portions),[3,3,3,3,3,2,2,2,3]);
  for(const m of w.meals){assert(m.steps.length>=5);assert(!/капуст|перлов|печ[её]ночн.*олад|индейк.*горох/i.test(m.title));for(const [id,n] of Object.entries(m.items)){assert(n>0&&Number.isFinite(n));assert(novemberPrices[id],id);}}
 }
 assert.equal(new Set(novemberWeeks.flatMap(w=>w.meals.map(m=>m.id))).size,36);
});
test('every weekly purchase balances inventory, whole packs, recipe demand and integer kopecks',()=>{
 for(const useProjectedStock of [true,false]){
  const result=calculateNovember({useProjectedStock});
  let last=useProjectedStock?novemberOpeningStock:{};let total=0;
  for(const [i,w] of result.weeks.entries()){
   const demand={...novemberExtras.items};for(const m of novemberWeeks[i].meals)for(const [id,n] of Object.entries(m.items))demand[id]=(demand[id]||0)+n;
   let food=0;const next={};
   for(const r of w.rows){const p=novemberPrices[r.id];assert.equal(r.used,demand[r.id]||0,r.id);
    if(r.household){assert.equal(r.opening,null);assert.equal(r.closing,null);assert.equal(r.costKopecks,0);continue;}
    assert.equal(r.opening,last[r.id]||0);assert.equal(r.opening+r.purchase-r.used,r.closing);assert(r.closing>=0);assert.equal(r.purchase%p.increment,0);
    const n=r.purchase/p.increment;assert.equal(r.costKopecks,n*p.pricePerIncrementKopecks);assert(Number.isInteger(r.costKopecks));food+=r.costKopecks;next[r.id]=r.carryForward;
    if(p.storage==='weekly')assert.equal(r.carryForward,0);
   }
   assert.equal(w.foodKopecks,food);assert.equal(w.bufferKopecks,Number((BigInt(food)*5n+9999n)/10000n)*100);assert.equal(w.totalKopecks,food+w.bufferKopecks);total+=w.totalKopecks;last=next;
  }
  assert.equal(result.totalKopecks,total);assert.equal(result.totalKopecks,result.foodKopecks+result.bufferKopecks);
 }
});
test('known scenario totals, unknown household prices and conditional base stay distinct',()=>{
 const withStock=calculateNovember(),without=calculateNovember({useProjectedStock:false});
 assert.deepEqual(withStock.weeks.map(w=>w.totalKopecks),[574979,494917,486204,419735]);
 assert.equal(withStock.totalKopecks,1975835);assert.equal(without.totalKopecks,2001133);
 assert.deepEqual(Object.fromEntries(withStock.baseNeeds.map(r=>[r.id,r.used])),{oil:311,salt:92,spices:29,flour:495,sugar:100,butter:75});
 assert.equal(withStock.conditionalPricedBaseKopecks,50595);assert.deepEqual(withStock.unpricedBase,['oil','salt']);
 assert.equal(novemberPrices.oil.pricePerIncrementKopecks,null);assert.equal(novemberPrices.salt.pricePerIncrementKopecks,null);
 assert.throws(()=>calculateNovember({stockOverrides:{pork:-1}}));assert.throws(()=>calculateNovember({stockOverrides:{unknown:100}}));
 assert.equal(calculateNovember({stockOverrides:{bulgur:0}}).weeks[0].rows.find(r=>r.id==='bulgur').opening,0);
});
test('receipt forms and quantities do not turn whole fish into fillets or unknown bags into grams',()=>{
 assert.match(novemberPrices.fishwhole.name,/целая/);assert.equal(novemberPrices.fishwhole.source.unit,'kg');
 assert.equal(novemberPrices.bulgur.increment,500);assert.equal(novemberPrices.bulgur.source.date,'2026-08-16');
 assert.equal(novemberPrices.milk.unit,'мл');assert.equal(novemberPrices.milk.source.unit,'l');assert.equal(novemberPrices.milk.storage,'freeze');
 assert.equal(novemberPrices.corn.increment,340);assert.match(novemberPrices.corn.name,/заливк/);
 const fishMeals=novemberWeeks.flatMap(w=>w.meals).filter(m=>m.items.fishwhole);assert.equal(fishMeals.length,2);for(const m of fishMeals){assert.equal(m.items.fishwhole,1000);assert.match(m.note,/не 1 кг филе/);}
 for(const [id,p] of Object.entries(novemberPrices)){if(p.pricePerIncrementKopecks===null)continue;assert(p.source?.observationId,id);assert(p.source.paidKopecks>0&&p.source.quantity>0);assert(Number.isInteger(p.pricePerIncrementKopecks));}
});
test('native recipe amounts and generated shopping use the same November source',async()=>{
 const source=await readFile(new URL('../app/november-plan-data.ts',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const generated=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 assert.equal(generated.novemberTotal,19758.35);assert.equal(generated.novemberNoStockTotal,20011.33);
 for(const [i,w] of generated.novemberMenuWeeks.entries()){for(const [j,m] of w.meals.entries()){const raw=novemberWeeks[i].meals[j];assert.equal(m.recipe.portions,raw.portions+' порции');assert.deepEqual(m.recipe.steps,raw.steps);assert.deepEqual(m.recipe.ingredients,Object.entries(raw.items).map(([id,n])=>novemberPrices[id].name+' — '+n+' '+novemberPrices[id].unit));}}
 const html=await readFile(new URL('../public/november-plan.html',import.meta.url),'utf8');assert(html.includes('id="use-stock"'));assert(html.includes('id="all-csv"'));assert(!html.includes('/*MODEL*/'));assert.doesNotMatch(html,/check\.yandex|nutrition-memory|E:\\|fn=|fpd=/i);
});
test('downloaded CSV has a UTF-8 BOM, real newlines and the selected stock scenario',async()=>{
 const html=await readFile(new URL('../public/november-plan.html',import.meta.url),'utf8');
 const start=html.indexOf('function csv(weeks)'),end=html.indexOf('function download(',start);assert(start>0&&end>start);
 const csv=new Function('novemberPrices','calculation',html.slice(start,end)+';return csv(calculation.weeks);');
 for(const useProjectedStock of [true,false]){
  const calculation=calculateNovember({useProjectedStock});const text=csv(novemberPrices,calculation);
  assert.equal(text.charCodeAt(0),0xfeff);assert(!text.includes('\\r\\n'));
  assert.equal(text.split('\r\n').length,1+calculation.weeks.reduce((n,w)=>n+w.rows.filter(r=>r.purchase>0).length,0));
  assert(text.includes(useProjectedStock?'учтён, проверить':'не учтён'));
 }
});
