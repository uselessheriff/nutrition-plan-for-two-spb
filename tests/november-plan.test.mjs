import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {novemberWeeks,novemberPrices,novemberOpeningStock,novemberExtras,calculateNovember} from '../plan-source/november-plan.mjs';

test('four November weeks contain 24 dinners for three and 12 meals for two',()=>{
 assert.deepEqual(novemberWeeks.map(w=>[w.number,w.start,w.end]),[[13,'2026-11-02','2026-11-08'],[14,'2026-11-09','2026-11-15'],[15,'2026-11-16','2026-11-22'],[16,'2026-11-23','2026-11-29']]);
 for(const w of novemberWeeks){
  assert.equal(w.meals.length,w.number===13?10:9);
  assert.deepEqual(w.meals.filter(m=>!m.yieldPieces).map(m=>m.portions),[3,3,3,3,3,2,2,2,3]);
  for(const m of w.meals){assert(m.steps.length>=5);assert(!/капуст|перлов|печ[её]ночн.*олад|индейк.*горох/i.test(m.title));for(const [id,n] of Object.entries(m.items)){assert(n>0&&Number.isFinite(n));assert(novemberPrices[id],id);}}
 }
 assert.equal(new Set(novemberWeeks.flatMap(w=>w.meals.map(m=>m.id))).size,37);
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
    const n=r.purchase/p.increment;if(n>0&&p.pricePerIncrementKopecks===null){assert.equal(r.costKopecks,null);assert(w.unknownPurchases.includes(r.id));}else{assert.equal(r.costKopecks,n*p.pricePerIncrementKopecks);assert(Number.isInteger(r.costKopecks));}food+=r.costKopecks;next[r.id]=r.carryForward;
    if(p.storage==='weekly')assert.equal(r.carryForward,0);
   }
   assert.equal(w.foodKopecks,food);assert.equal(w.bufferKopecks,Number((BigInt(food)*5n+9999n)/10000n)*100);assert.equal(w.totalKopecks,food+w.bufferKopecks);total+=w.totalKopecks;last=next;
  }
  assert.equal(result.totalKopecks,total);assert.equal(result.totalKopecks,result.foodKopecks+result.bufferKopecks);
 }
});
test('known scenario totals, unknown household prices and conditional base stay distinct',()=>{
 const withStock=calculateNovember(),without=calculateNovember({useProjectedStock:false});
 assert.deepEqual(withStock.weeks.map(w=>w.totalKopecks),[380885,540940,487795,456316]);
 assert.equal(withStock.totalKopecks,1865936);assert.equal(withStock.hasUnpricedPurchases,false);assert.equal(without.hasUnpricedPurchases,true);assert.deepEqual(without.weeks[0].unknownPurchases.sort(),["cutlets","oats","semolina"]);
 assert.deepEqual(withStock.baseNeeds.map(r=>r.id).sort(),["oil","spices","sugar"]);
 assert(withStock.conditionalPricedBaseKopecks>0);assert.deepEqual(withStock.unpricedBase,["oil"]);
 assert.equal(novemberPrices.oil.pricePerIncrementKopecks,null);assert.equal(novemberPrices.salt.pricePerIncrementKopecks,5000);assert.equal(novemberPrices.salt.source,null);assert(novemberPrices.salt.estimateSource.url);
 assert.throws(()=>calculateNovember({stockOverrides:{pork:-1}}));assert.throws(()=>calculateNovember({stockOverrides:{unknown:100}}));
 assert.equal(calculateNovember({stockOverrides:{bulgur:0}}).weeks[0].rows.find(r=>r.id==='bulgur').opening,0);
});
test('receipt forms and quantities do not turn whole fish into fillets or unknown bags into grams',()=>{
 assert.match(novemberPrices.fishwhole.name,/целая/);assert.equal(novemberPrices.fishwhole.source.unit,'kg');
 assert.equal(novemberPrices.bulgur.increment,400);assert.equal(novemberPrices.bulgur.source.date,'2026-10-25');
 assert.equal(novemberPrices.milk.unit,'мл');assert.equal(novemberPrices.milk.source.unit,'l');assert.equal(novemberPrices.milk.storage,'freeze');
 assert.equal(novemberPrices.corn.increment,340);assert.match(novemberPrices.corn.name,/заливк/);
 const fishMeals=novemberWeeks.flatMap(w=>w.meals).filter(m=>m.items.fishwhole);assert.equal(fishMeals.length,1);for(const m of fishMeals){assert.equal(m.items.fishwhole,1000);assert.match(m.note,/не 1 кг филе/);}
 for(const [id,p] of Object.entries(novemberPrices)){if(p.pricePerIncrementKopecks===null||p.estimateSource)continue;assert(p.source?.observationId,id);assert(p.source.paidKopecks>0&&p.source.quantity>0);assert(Number.isInteger(p.pricePerIncrementKopecks));}
});
test('native recipe amounts and generated shopping use the same November source',async()=>{
 const source=await readFile(new URL('../app/november-plan-data.ts',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const generated=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 assert.equal(generated.novemberTotal,18659.36);
 for(const [i,w] of generated.novemberMenuWeeks.entries()){for(const [j,m] of w.meals.entries()){const raw=novemberWeeks[i].meals[j];assert.equal(m.recipe.portions,raw.yieldPieces?`1 пирог (${raw.yieldPieces} кусочков)`:raw.portions+' порции');assert.deepEqual(m.recipe.steps,raw.steps);assert.deepEqual(m.recipe.ingredients,Object.entries(raw.items).map(([id,n])=>novemberPrices[id].name+' — '+n+' '+novemberPrices[id].unit));}}
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

test('actual week13 inventory, baking and week12 reported purchases stay separate',async()=>{
 const {weekTwelvePurchases,weekTwelveExtras,weekTwelveHousehold,weekTwelveReportedTotal}=await import('../plan-source/week-twelve-actual.mjs');
 assert.equal(weekTwelvePurchases.length,27);assert.equal(weekTwelveExtras.length,10);assert.equal(weekTwelveHousehold.length,2);
 const sum=rows=>Math.round(rows.reduce((n,r)=>n+r.amount,0)*100);
 assert.equal(sum(weekTwelvePurchases),368353);assert.equal(sum(weekTwelveExtras),140000);assert.equal(sum(weekTwelveHousehold),27898);assert.equal(weekTwelveReportedTotal,5083.53);
 assert.equal(weekTwelveExtras.filter(r=>r.name.startsWith('Зефир')).length,2);
 assert.equal(novemberOpeningStock.bulgur,180);assert.equal(novemberOpeningStock.cutlets,120);assert.equal(novemberOpeningStock.pork,485);
 const w=calculateNovember().weeks[0],row=id=>w.rows.find(r=>r.id===id);
 for(const id of ['bulgur','cutlets','curd','milk','pork','mince','passata','carrot','pepper','cucumber','mushrooms','freshlemon','flour','oats','semolina'])assert.equal(row(id).purchase,0,id);
 assert.equal(row('salt').purchase,1000);assert.equal(row('peas').closing,680);assert.equal(row('milk').closing,500);assert.equal(row('flour').closing,590);
 const baking=novemberWeeks[0].meals.filter(m=>m.yieldPieces);assert.equal(baking.length,1);assert.equal(baking[0].portions,2);assert.equal(baking[0].items.pear,600);assert.equal(row('pear').used,1300);
});


test('fish frequency is at most once per 14 days and week13 lunch is the one baked pie',()=>{
 const dayOffset={Пн:0,Вт:1,Ср:2,Чт:3,Пт:4,Сб:5,Вс:6},dayMs=86400000;
 const fishDates=novemberWeeks.flatMap(w=>w.meals.filter(m=>Object.keys(m.items).some(id=>id.startsWith('fish'))).map(m=>Date.parse(w.start)+dayOffset[m.day]*dayMs)).sort((a,b)=>a-b);
 const dates=[Date.parse('2026-10-30'),...fishDates]; // Previous planned fish dinner; not a claim of cooking.
 for(let i=1;i<dates.length;i++)assert((dates[i]-dates[i-1])/dayMs>=14);
 assert.deepEqual(fishDates.map(t=>new Date(t).toISOString().slice(0,10)),['2026-11-20']);
 const plan=novemberWeeks[0],purchase=calculateNovember().weeks[0],row=id=>purchase.rows.find(r=>r.id===id);
 assert(plan.meals.every(m=>!Object.keys(m.items).some(id=>id.startsWith('fish'))));
 assert(!row('fishwhole'));assert.equal(row('turkey').purchase,480);assert.equal(row('turkey').costKopecks,41999);
 assert.equal(row('sourcream').used,180);assert.equal(row('sourcream').purchase,180);assert.equal(row('freshlemon').closing,140);
 const sunday=plan.meals.filter(m=>m.day==='Вс');assert.deepEqual(sunday.map(m=>m.type),['Завтрак','Обед','Ужин']);
 assert.deepEqual(sunday.map(m=>m.portions),[2,2,3]);assert.equal(sunday[1].yieldPieces,6);assert.equal(sunday[1].leftoverPieces,2);
 assert.equal(plan.meals.filter(m=>m.id==='n13-baking').length,1);assert.equal(row('pear').used,1300);assert.equal(row('flour').used,210);assert.equal(row('egg').used,9);
});


test('mince is bought as mince, never made from fillets, and prices match the purchased pack',()=>{
 const p=novemberPrices.turkeymince;
 assert.equal(p.increment,450);assert.equal(p.pricePerIncrementKopecks,24999);
 assert.equal(p.source.observationId,'legacy-expense-53');assert.equal(p.source.date,'2026-08-22');assert.equal(p.source.quantity,450);assert.equal(p.source.unit,'g');
 const m13=novemberWeeks[0].meals.find(m=>m.id==='n13-3'),m16=novemberWeeks[3].meals.find(m=>m.id==='n16-0');
 for(const m of [m13,m16]){assert.equal(m.items.turkeymince,450);assert.equal(m.items.chicken,undefined);assert.equal(m.items.turkey,undefined);assert(m.steps.some(s=>s.includes('покупного сырого фарша')));assert.equal(m.portions,3);}
 for(const w of novemberWeeks)for(const m of w.meals)for(const step of m.steps)assert.doesNotMatch(step,/(?:куриц|индейк|филе|мяс)[^.,;]{0,80}(?:измельчите|прокрутите|мелко порубите)|измельчите[^.]{0,80}в фарш|мясорубк/iu,m.id);
 const calc=calculateNovember();for(const i of [0,3]){const r=calc.weeks[i].rows.find(r=>r.id==='turkeymince');assert.equal(r.used,450);assert.equal(r.purchase,450);assert.equal(r.costKopecks,24999);assert.equal(r.closing,0);}
 const chicken=calc.weeks[0].rows.find(r=>r.id==='chicken');assert.equal(chicken.used,900);assert.equal(chicken.purchase,900);
 const oats=novemberWeeks[0].meals.find(m=>m.id==='n13-7');assert(oats.steps[0].includes('разомните вилкой'));assert.equal(oats.items.oats,120);assert.equal(oats.items.milk,250);
});
