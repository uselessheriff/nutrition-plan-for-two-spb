const $=id=>document.getElementById(id);
const num=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const money=n=>num.format(n)+' ₽';
const qty=(id,n,week=5)=>n===null?'Вес не подтверждён':num.format(n)+' '+currentIngredient(id,week).unit;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeTier=1;
let activeWeek=5,lastTrigger=null;
const expandedShopping=new Set([5]);
const view=typeof location==='undefined'?'all':new URLSearchParams(location.search).get('view')||'all';
if(['shopping','stock','expenses'].includes(view))document.documentElement.dataset.view=view;
if(typeof location!=='undefined'&&location.search.includes('embed=1'))document.documentElement.classList.add('embedded');
const key='petersburg-ration-september-2026-v2'; // Preserve the existing local journal key.
const snapshot='2026-10-10';
let saved={grains:{},entries:[],grainSnapshot:snapshot,previousGrains:{}},storageOK=true;
try{
 const old=JSON.parse(localStorage.getItem(key)||'null');
 if(old&&typeof old==='object'){
  if(old.grains&&typeof old.grains==='object'){
   const values=Object.fromEntries(['rice','bulgur','couscous'].filter(id=>Number.isFinite(old.grains[id])&&old.grains[id]>=0&&old.grains[id]<=5000).map(id=>[id,old.grains[id]]));
   if(old.grainSnapshot===snapshot)saved.grains=values;else saved.previousGrains=values;
  }
  if(old.previousGrains&&typeof old.previousGrains==='object'&&!Object.keys(saved.previousGrains).length)saved.previousGrains=old.previousGrains;
  if(Array.isArray(old.entries))saved.entries=old.entries.filter(x=>x&&typeof x.name==='string'&&x.name.length<=140&&Number.isFinite(x.amount)&&x.amount>0&&x.amount<=100000&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&['review','w0','w1','w2','w3','w4','w5','w6','w7','unassigned'].includes(x.period)).map(x=>({name:x.name,amount:x.amount,date:x.date,period:x.period}));
 }
}catch{storageOK=false;}
function persist(){try{localStorage.setItem(key,JSON.stringify(saved));storageOK=true;return true;}catch{storageOK=false;return false;}}
function plan(){return calculate(activeTier,saved.grains);}
const chip=(label,value)=>`<span class="chip">${esc(label)}: ${esc(value)}</span>`;
function dateFor(w,index){const d=new Date(weeks[w].date+'T12:00:00');d.setDate(d.getDate()+slots[index][2]);return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});}
function renderDashboard(){const p=plan();$('dashboard').innerHTML=chip('Лимит на недели 9–12',money(25000))+chip('Учтено + прогноз 9–12',money(p.total));}
function renderMenu(){
 $('week-tabs').innerHTML=[4,5,6,7,0,1,2,3].map(i=>`<button type="button" data-week="${i}" class="${activeWeek===i?'active':''}" aria-pressed="${activeWeek===i}">Неделя ${i+5} · ${esc(weeks[i].label)}</button>`).join('');
 $('week-heading').innerHTML=`<div class="week-heading"><h3>${esc(weekTheme(activeWeek))}</h3><span class="tag">${activeWeek<=4?'Архив плана · не факт':'Запланировано'}</span></div>`;
 $('meal-list').innerHTML=mealEntries(activeWeek,activeTier).map(({id,slot:i})=>{
  const r=recipeFor(id,activeTier),cal=calories(r),update=activeWeek===0?weekFiveMealUpdates[i]:null;
  return `<button class="meal-card ${i>=5?'weekend':''}" type="button" data-recipe="${id}" aria-haspopup="dialog"><span class="meal-top"><span>${slots[i][0]} · ${dateFor(activeWeek,i)} · ${slots[i][1]}</span><span class="tag">${r.newInPlan?'Новый вариант':i>=5?'Гибкий план':esc(r.protein)}</span></span><span class="meal-title">${esc(r.title)}</span>${update?`<small>${esc(update.note)}</small>`:''}<span class="meal-footer">≈ ${cal} ккал / человеку · ${r.time} мин →</span><small>${esc(portionLabel(r))}${i<5&&activeWeek>=4?` · с рабочим обедом 1 300: ≈ ${cal+1300} ккал*`:''}</small></button>`;
 }).join('');
 $('week-prep').innerHTML=`<h3>Подготовка</h3><p>${activeWeek>=4?'Разделите мясо по рецептам, неиспользованный остаток сразу заморозьте. Фрукты покупайте свежими на эту неделю. Пятница — 2 порции, воскресный ужин — 3.':'Архивные блюда показывают план, а не подтверждённую готовку.'}</p><p>*Сумма рабочего обеда и ужина парня, не вся еда за день.</p>`;
 $('extras').innerHTML=extras(activeTier,activeWeek).map(e=>`<div class="extra"><strong>${esc(e.title)}</strong><p>${esc(e.how)}</p><small>На неделю: ${Object.entries(e.items).map(([id,q])=>`${esc(currentIngredient(id,activeWeek).name.toLowerCase())} ${qty(id,q,activeWeek)}`).join('; ')}.</small></div>`).join('');
}
function historyShopping(index,week){
 if(index===1)return `<details class="shopping-week surface" data-shopping-week="1"><summary><span><strong>Неделя 6 · архив плана</strong><small>14–20 сентября · не повторять</small></span></summary><div class="shopping-week-content"><p>Прежний прогноз ${money(week.total)} не является фактом. Чек 12.09 и допокупка 19.09 сохранены в расходах отдельно.</p></div></details>`;
 const lists=index===0?weekFivePurchases:index===2?[...weekSevenPurchases,...weekSevenExtras]:index===4?[...weekNinePurchases,...weekNineExtras]:[...weekEightPurchases,...weekEightExtras];
 const total=index===0?weekFiveActual:index===2?weekSevenActual:index===4?weekNineReportedTotal:weekEightReportedTotal;
 const caption=index===4?'Чек от 03.10 — 3 180,39 ₽; отнесён вами к неделе 9. Дополнительные вкусности — 600 ₽ одной суммой. Все позиции чека съедобные; полнота расходов не подтверждена.':index===3?'Чек 27.09 — 5 103,62 ₽, дополнительные покупки — 970 ₽. Все позиции чека относятся к еде. Вода 120 ₽ включена только в прошедший факт, а не в будущую закупку. Полнота недели не подтверждена.':index===2?'Чек 20.09 и допокупки; полнота расходов не подтверждена.':'Исторические покупки, не список для повторной закупки.';
 return `<details class="shopping-week surface" data-shopping-week="${index}"><summary><span><strong>Неделя ${index+5} · покупки</strong><small>${esc(weeks[index].label)} · архив</small></span><span class="week-price">${money(total)}<small>Сообщено</small></span></summary><div class="shopping-week-content"><p>${caption}</p><ul>${lists.map(x=>`<li>${esc(x.name)}${x.quantity?' · '+esc(x.quantity):''} — ${money(x.amount)}</li>`).join('')}</ul></div></details>`;
}
function shoppingWeek(index,week){
 const rows=week.rows.filter(r=>r.opening!==null||r.purchase>0);
 const buying=rows.filter(r=>r.purchase>0);
 const groups=groupShoppingRows(buying,id=>currentIngredient(id,index).name);
 const warning=id=>id==='couscous'&&index===4?'3 домашних пакетика оценены по 80 г из чека 27.09; сверьте упаковку.':id==='banana'&&index<5?'Количество — мякоть; с кожурой берите примерно в 1,5 раза больше.':['oil','salt','sugar'].includes(id)?'Проверить дома: новый остаток не указан. Если хватает на неделю, повторно не покупать.':id==='butter'&&index===5?'Дома нет — покупку подтвердили. На рецепты недели нужно 37 г.':id==='fish'?'Нужен чистый вес филе без кожи, костей и глазури.':' ';
 return `<details class="shopping-week surface" data-shopping-week="${index}" ${expandedShopping.has(index)?'open':''}>
  <summary><span><strong>Неделя ${index+5}</strong><small>${esc(weeks[index].label)} · ${buying.length} позиций к покупке</small></span><span class="week-price">${money(week.total)}<small>План с резервом</small></span><span class="disclosure-icon" aria-hidden="true">⌄</span></summary>
  <div class="shopping-week-content"><h3>Что купить на неделю ${index+5}</h3><p class="buy-explanation">По отделам магазина: продукт → купить после вычета домашнего запаса → прогноз цены. Для скоропортящихся остатков прошлых недель перенос не предполагается; пригодные замороженные мясные излишки учтены.</p>
  ${groups.map(group=>`<section class="buy-department" data-buy-department="${group.id}" aria-labelledby="department-${index}-${group.id}"><header class="department-heading"><h4 id="department-${index}-${group.id}">${esc(group.label)}</h4><span>${money(group.total)}</span></header><div class="buy-columns" aria-hidden="true"><span>Продукт</span><span>Купить</span><span>Цена</span></div><ul class="buy-list">${group.rows.map(r=>{const i=currentIngredient(r.id,index);return `<li data-buy-product="${r.id}"><div class="buy-product"><strong>${esc(i.name)}</strong></div><div class="buy-quantity"><span class="sr-only">Купить: </span><strong>${qty(r.id,r.purchase,index)}</strong></div><div class="buy-price"><span class="sr-only">Плановая цена: </span><strong>${money(r.cost)}</strong></div>${warning(r.id).trim()?`<p class="buy-hint">${esc(warning(r.id))}</p>`:''}</li>`}).join('')}</ul></section>`).join('')}
  <div class="shopping-actions"><button type="button" class="utility" data-download-week="${index}">Скачать список недели ${index+5}</button><span>Закупка: к началу недели ${esc(weeks[index].label)}</span></div>
  <div class="chips">${chip('Продукты',money(week.food))}${chip('Самостоятельная покупка','доставка 0 ₽')}${chip('Резерв цены 5%',money(week.buffer))}</div><p class="muted">${esc(index>=5?weekTenPriceNote:octoberPriceNote)}</p>
  <details class="calculation-details"><summary>Подробный расчёт: фасовка, остатки и блюда</summary><div class="table-scroll"><table><caption class="sr-only">Расчёт недели ${index+5}</caption><thead><tr><th scope="col">Продукт</th><th scope="col">Купить</th><th scope="col">Цена</th><th scope="col">Нужно</th><th scope="col">Есть</th><th scope="col">Останется</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(currentIngredient(r.id,index).name)}</strong><small>Фасовка: ${qty(r.id,r.pack,index)} · ${money(r.unitPrice)}.</small><details><summary>Куда идёт</summary><ul>${r.alloc.map(([name,n])=>`<li>${esc(name)}: ${qty(r.id,n,index)}</li>`).join('')}</ul></details></td><td>${r.purchase?qty(r.id,r.purchase,index):'Не нужно'}</td><td>${r.cost?money(r.cost):'—'}</td><td>${qty(r.id,r.used,index)}</td><td>${qty(r.id,r.opening,index)}</td><td>${qty(r.id,r.closing,index)}</td></tr>`).join('')}</tbody></table></div><h4>Расход домашней базы</h4><ul>${week.rows.filter(r=>r.opening===null&&r.purchase===0).map(r=>`<li>${esc(currentIngredient(r.id,index).name)}: ${qty(r.id,r.used,index)}</li>`).join('')}</ul><p class="muted">Остаток после недели — прогноз, не подтверждение фактического наличия.</p></details></div></details>`;
}
function renderShopping(){const p=plan();$('shopping-weeks').innerHTML=[5,6,7,4,3,2,1,0].map(index=>index<=4?historyShopping(index,p.weeks[index]):shoppingWeek(index,p.weeks[index])).join('');$('shopping-budget').innerHTML=chip('Лимит 9–12',money(25000))+chip('Учтено + прогноз 9–12',money(p.total))+chip('Сообщено за 9',money(p.currentCycleConfirmed))+chip('Прогноз 10–12',money(p.remainingTotal));}
function renderStock(){
 $('stock-list').innerHTML=Object.entries(weekTenStock).filter(([id])=>id!=='porkbones').map(([id,n])=>`<div class="stock-item">${esc(currentIngredient(id,5).name)}<strong>${qty(id,n,5)}</strong></div>`).join('')+weekTenReserves.map(([name,value])=>`<div class="stock-item">${esc(name)}<strong>${esc(value)}</strong></div>`).join('');
 $('stock-notes').innerHTML=weekTenNotes.map(s=>`<li>${esc(s)}</li>`).join('');
 for(const id of ['rice','bulgur','couscous'])$('grain-form').elements.namedItem(id).value=saved.grains[id]??weekTenStock[id]??0;
}
function openRecipe(id,trigger){
 const r=recipeFor(id,activeTier);lastTrigger=trigger;
 $('recipe-eyebrow').textContent=`Неделя ${activeWeek+5} · ${tiers[activeTier].name}`;
 $('recipe-title').textContent=r.title;
 $('recipe-meta').innerHTML=chip('Порции',String(r.portions))+chip('Время',r.time+' мин')+chip('Калории',`≈ ${calories(r)} на человека`);
 $('recipe-ingredients-title').textContent='Ингредиенты на '+r.portions+' порции';
 $('recipe-ingredients').innerHTML=Object.entries(r.items).map(([item,q])=>`<li><span>${esc(currentIngredient(item,activeWeek).name)}</span><strong>${qty(item,q,activeWeek)}</strong></li>`).join('');
 $('recipe-steps').innerHTML=r.steps.map(s=>`<li>${esc(s)}</li>`).join('');$('recipe-note').textContent=r.note||S;
 const d=$('recipe-dialog');if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');document.body.style.overflow='hidden';$('recipe-close').focus();
}
function closeRecipe(){const d=$('recipe-dialog');if(typeof d.close==='function')d.close();else d.removeAttribute('open');document.body.style.overflow='';lastTrigger?.focus();}
const seed=[...weekFivePurchases,...additionalConfirmed,...weekSevenPurchases,...weekSevenExtras,...weekEightPurchases,...weekEightExtras,...weekNinePurchases,...weekNineExtras,{period:'review',name:'Ранее учтённая корзина недели 4: чек 29.08 + отдельные фрукты и молоко',amount:4165.51,date:'Неделя 31.08–06.09',source:'сохранённый журнал сайта'},{period:'review',name:'Яйца, 10 шт.',amount:130,date:'Сообщено 06.09',source:'со слов пользователя'},{period:'review',name:'Яблоки, корица, разрыхлитель, тесто',amount:780,date:'Сообщено 06.09',source:'единая сумма со слов пользователя'}];
function renderExpenses(){
 const period=$('expense-period').value,all=[...seed,...saved.entries.map(x=>({...x,source:'ручная запись в этом браузере'}))].filter(x=>x.period===period),total=all.reduce((s,x)=>s+x.amount,0),week=Number(period.slice(1));
 const comparison=period==='review'?'Сохранённые покупки недели 4':period==='unassigned'?'Дата известна, неделя меню не назначена':period==='w3'?'Чек 5 103,62 ₽ + допокупки 970 ₽; прежний прогноз не факт':period==='w4'?'Чек 3 180,39 ₽ + допокупки 600 ₽; дата чека 03.10':week>=5?`Прогноз недели: ${money(plan().weeks[week].total)}`:period==='w2'?'Чек 2 366,56 ₽ + допокупки 280 ₽':period==='w1'?'Учтена только допокупка 500 ₽, не полный расход':period==='w0'?'Сообщённые покупки недели 5':'Проверить по чекам';
 $('expense-summary').innerHTML=chip('Внесено',money(total))+chip('Статус',comparison)+chip('Полнота',week>=5?'будущая неделя, пока нет чеков':'проверить по чекам')+(saved.entries.some(x=>x.period===period)?'<p class="notice">Проверьте, не дублируют ли ручные записи покупки из чата.</p>':'');
 $('expense-list').innerHTML=all.length?all.map(x=>`<div class="expense-row"><div>${esc(x.name)}<small>${esc(x.date)} · ${esc(x.source)}</small></div><strong>${money(x.amount)}</strong></div>`).join(''):'<p class="muted">Подтверждённых расходов пока нет. Это не означает, что неделя обошлась в 0 ₽.</p>';
}
function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function downloadShopping(weekIndex){const p=plan().weeks[weekIndex],cell=v=>'"'+String(v).replaceAll('"','""')+'"',groups=groupShoppingRows(p.rows.filter(r=>r.purchase>0),id=>currentIngredient(id,weekIndex).name);const lines=[['Период',weeks[weekIndex].label,'Лимит',25000],['Продукт','Купить','Плановая стоимость ₽','Отдел','Нужно','Есть','Останется','Куда идёт'],...groups.flatMap(group=>group.rows.map(r=>[currentIngredient(r.id,weekIndex).name,qty(r.id,r.purchase,weekIndex),r.cost,group.label,qty(r.id,r.used,weekIndex),qty(r.id,r.opening,weekIndex),qty(r.id,r.closing,weekIndex),r.alloc.map(([s,q])=>s+': '+qty(r.id,q,weekIndex)).join(' | ')])),['Доставка','',0],['Резерв 5%','',p.buffer],['ИТОГО план','',p.total]];download(`zakupka-nedelya-${weekIndex+5}-25000.csv`,'\ufeff'+lines.map(row=>row.map(cell).join(';')).join('\r\n'),'text/csv;charset=utf-8');}
function render(){renderDashboard();renderMenu();renderShopping();renderExpenses();}
for(let i=4;i<8;i++){const option=document.createElement('option');option.value='w'+i;option.textContent=`Неделя ${i+5} · ${weeks[i].label}`;$('expense-period').append(option);}
$('expense-period').value='w3';
$('week-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(b){activeWeek=Number(b.dataset.week);render();}});
$('meal-list').addEventListener('click',e=>{const b=e.target.closest('[data-recipe]');if(b)openRecipe(b.dataset.recipe,b);});
$('shopping-weeks').addEventListener('click',e=>{const b=e.target.closest('[data-download-week]');if(b)downloadShopping(Number(b.dataset.downloadWeek));});
$('shopping-weeks').addEventListener('toggle',e=>{if(e.target.dataset.shoppingWeek!==undefined){const week=Number(e.target.dataset.shoppingWeek);if(e.target.open)expandedShopping.add(week);else expandedShopping.delete(week);}},true);
$('recipe-close').addEventListener('click',closeRecipe);$('recipe-dialog').addEventListener('cancel',e=>{e.preventDefault();closeRecipe();});$('recipe-dialog').addEventListener('click',e=>{if(e.target===$('recipe-dialog'))closeRecipe();});
$('grain-form').addEventListener('submit',e=>{e.preventDefault();for(const id of ['rice','bulgur','couscous']){const v=e.target.elements.namedItem(id).value;if(v==='')delete saved.grains[id];else saved.grains[id]=Number(v);}saved.grainSnapshot=snapshot;persist();render();$('grain-status').textContent=storageOK?'Расчёт обновлён. Веса сохранены в этом браузере.':'Расчёт обновлён, но браузер не разрешил сохранение. Выгрузите JSON.';});
$('expense-period').addEventListener('change',renderExpenses);
$('expense-form').addEventListener('submit',e=>{e.preventDefault();const f=e.target.elements,amount=Number(f.namedItem('amount').value),name=f.namedItem('name').value.trim(),date=f.namedItem('date').value;if(!name||!Number.isFinite(amount)||amount<=0||!date)return;saved.entries.push({name,amount:Math.round(amount*100)/100,date,period:$('expense-period').value});persist();renderExpenses();f.namedItem('name').value='';f.namedItem('amount').value='';$('expense-status').textContent=storageOK?'Добавлено. Запись хранится только в этом браузере.':'Добавлено на эту страницу; сохранение недоступно. Выгрузите JSON до закрытия.';});
$('export-journal').addEventListener('click',()=>{let legacy=null;try{legacy=JSON.parse(localStorage.getItem('petersburg-ration-actual-week-expenses-v1')||'null');}catch{}download('zhurnal-pitaniya-2026-10.json',JSON.stringify({period,exportedAt:new Date().toISOString(),confirmed:seed,local:saved,legacy,notice:'Прогноз и фактические расходы не объединены. Старые вводы круп сохранены в previousGrains.'},null,2),'application/json');});
$('print').addEventListener('click',()=>window.print());
$('expense-form').elements.namedItem('date').value=new Date().toLocaleDateString('en-CA');
try{if(localStorage.getItem('petersburg-ration-actual-week-expenses-v1'))$('legacy-note').innerHTML='<p class="notice">В этом браузере есть старый журнал. Он сохранён отдельно и войдёт в выгрузку JSON.</p>';}catch{}
$('expense-period').value='w4';
renderStock();render();
