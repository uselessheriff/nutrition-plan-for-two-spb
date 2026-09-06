import {activeRecipe, portionPolicy, portionLabel} from './active-plan.mjs';
export {portionPolicy, portionLabel};
// Quantities are raw/edible weights unless a counted unit is explicitly shown.
// Prices below are planning assumptions, never historical spending.
export const period = '07.09–04.10.2026';
export const reviewDate = '06.09.2026';
export const tiers = [
  {name:'До 20 000 ₽',cap:20000,copy:'Самовывоз; смешанный фарш, свинина вместо индейки и два блюда из одной упаковки печени. Салат с яйцом вместо креветок. Сок и сырки остаются, но реже.'},
  {name:'До 25 000 ₽',cap:25000,copy:'Полные порции, смешанный фарш и свинина, говяжье болоньезе, тунец и креветки. Покупаем сами, доставка 0 ₽; резерв на цены 5%.'},
  {name:'До 30 000 ₽',cap:30000,copy:'Лосось вместо горбуши, говядина вместо двух блюд из свинины, ягоды и орехи вместо части перекусов. Резерв доставки 400 ₽ в неделю.'}
];
// name, unit, purchase increment, price per increment, kcal per unit, initial stock
const rows = {
 egg:['Яйца','шт.',10,140,72,13], yogurt:['Йогурт греческий','г',250,100,.73,500], cheese:['Твёрдый сыр','г',200,220,3.5,170], feta:['Фетакса / фета','г',200,240,2.6,200],
 pickles:['Малосольные огурцы','г',400,160,.15,800], marinated:['Маринованные шампиньоны','г',300,180,.3,300], jam:['Варенье морошки','г',300,250,2.6,900],
 eggplant:['Баклажан средний','шт.',1,90,75,3], carrot:['Морковь','г',100,8,.35,100], tomato:['Помидор, условно 200 г','шт.',1,40,40,4], cucumber:['Свежие огурцы','г',100,16,.15,600], spinach:['Шпинат, условно 100 г','уп.',1,130,23,1],
 butter:['Сливочное масло','г',200,240,7.48,200], broccoli:['Брокколи замороженная','г',400,160,.34,400], chicken:['Куриное филе','г',100,60,1.2,760],
 passata:['Пассата','г',500,130,.3,1500], oats:['Овсянка','г',500,100,3.7,600], couscous:['Кускус сухой','г',450,130,3.5,0], rice:['Рис сухой','г',500,100,3.5,0], bulgur:['Булгур сухой','г',450,130,3.4,0], semolina:['Манка','г',800,100,3.3,400], millet:['Пшено','г',700,110,3.48,700], pasta:['Паста / спагетти сухие','г',450,80,3.5,450],
 pork:['Свинина без кости','г',400,200,1.9,0], beef:['Говядина для тушения','г',400,440,1.7,0], mince:['Говяжий фарш','г',400,350,2.1,0], turkey:['Индейка, филе бедра','г',410,369,1.5,0], liver:['Куриная печень','г',800,320,1.37,0], fish:['Филе минтая','г',400,380,.8,0], salmon:['Филе лосося','г',400,800,2.08,0],
 tuna:['Тунец, ≥120 г рыбы после слива','бан.',1,170,132,0], shrimp:['Креветки очищенные без глазури','г',500,900,.9,0], potato:['Картофель','г',100,10,.77,0], onion:['Лук репчатый','г',100,14,.4,0], cabbage:['Капуста','г',100,7,.25,0], pepper:['Сладкий перец','г',100,25,.27,0], zucchini:['Кабачок','г',100,15,.24,0], mushrooms:['Шампиньоны свежие','г',400,180,.27,0], garlic:['Чеснок','г',100,60,1.49,0],
 curd:['Творог 5%','г',400,240,1.21,0], milk:['Молоко 2,5%','мл',900,110,.52,0], sourcream:['Сметана 15%','г',200,100,1.62,0], bread:['Хлеб цельнозерновой','г',400,90,2.3,0], pita:['Лаваш / пита','г',200,90,2.7,0], dough:['Тесто для пиццы','г',400,180,2.5,0], buckwheat:['Гречка','г',800,130,3.4,0],
 apple:['Яблоки','г',100,16,.52,0], banana:['Бананы (мякоть)','г',100,26,.89,0], berries:['Ягоды замороженные','г',300,220,.5,0], nuts:['Орехи','г',150,220,6.2,0], juice:['Сок','мл',1000,180,.46,0], bar:['Сырок глазированный, 40 г','шт.',1,55,150,0],
 oil:['Растительное масло','г',1000,170,9,0], flour:['Пшеничная мука','г',1000,80,3.34,0], sugar:['Сахар','г',1000,80,4,0], salt:['Соль','г',1000,40,0,0], spices:['Специи','г',20,60,2,0], mustard:['Горчица','г',140,100,1.5,0], lemon:['Лимонный сок','мл',200,90,.2,0]
};
rows.porkmince=['Свиной фарш','г',400,200,2.4,0];
rows.mixedmince=['Фарш свинина + говядина','г',400,200,2.3,0];
// Updated from the household's price memory. Rounded FUTURE estimates, not edits to receipts.
rows.egg[3]=130; rows.yogurt[3]=90; rows.cheese[3]=190; rows.feta[3]=170;
rows.milk[3]=100; rows.pasta[3]=90; rows.rice[3]=140; rows.bulgur[3]=110;
rows.passata[3]=140; rows.mushrooms[3]=130;
rows.cabbage=['Пекинская капуста','г',100,20,.16,0];
rows.fish=['Филе горбуши (красная рыба)','г',400,450,1.42,0];
const base = ['oil','flour','sugar','salt','spices','mustard','lemon'];
export const ingredients = Object.fromEntries(Object.entries(rows).map(([id,r])=>[id,{id,name:r[0],unit:r[1],pack:r[2],price:r[3],kcal:r[4],stock:r[5],base:base.includes(id)}]));
export const stockNotes = [
 'Рис: 8 пакетиков; булгур: 5; кускус: 1. Масса неизвестна. В расчёте закупки запас этих круп пока не вычтен — сначала взвесьте и введите граммы ниже. Это консервативный резерв, не указание покупать крупу повторно.',
 'Баклажаны учтены поштучно (3), томаты — поштучно (4), шпинат — упаковкой (1). Для калорий приняты 300 г / 200 г / 100 г соответственно; фактическая масса неизвестна.',
 '2 банки белой фасоли и 1 кетчуп остаются резервом: фасоль не навязываем, масса содержимого не известна. Для всех основных блюд белок предусмотрен без фасоли.',
 'Два штруделя 1,8 кг и шарлотка 600 г — факт приготовления, не подтверждённый остаток. В закупку и калории будущих дней не добавлены. Если остались, замените ими запланированную сладость, а не добавляйте сверху.',
 'Масло растительное, мука, сахар, соль, специи, горчица и лимонный сок считаются домашней базой без известного веса. Их точный расход указан; перед походом в магазин проверьте запас. На пополнение заложено 800 ₽ в первую закупку — это резерв, не расход по чеку.'
];
export const recipes = [];
export function R(id,title,time,protein,items,steps,note='',salt=2) {
 const full={...items}; if(salt) full.salt=salt;
 if(!['Завтрак','Сладкое'].includes(protein)) full.spices=1;
 const r={id,title,time,protein,items:full,steps,note};recipes.push(r);return r;
}
export const S = 'Ингредиенты и все граммовки рассчитаны на 2 порции. Делите белок поровну; указанные калории — половина общего блюда, не дневная норма.';
export function recipeFor(id,tier=1) {
 const r=recipes.find(x=>x.id===id); if(!r) throw Error('Unknown recipe '+id);
 const copy={...r,items:{...r.items},steps:[...r.steps]};
 if(tier===0 && ['w1cutlet','w2meatballs'].includes(id)) {delete copy.items.mince;copy.items.mixedmince=400;copy.title=copy.title.replace('Говяжьи','Домашние');copy.protein='Смешанный фарш';copy.steps=copy.steps.map(s=>s.replace('400 г фарша','400 г смешанного фарша (свинина + говядина)'));}
 if(tier===0 && id==='w3turkey') {copy.items.chicken=400;delete copy.items.turkey;copy.title=copy.title.replace('Индейка','Курица');copy.protein='Курица';copy.steps=copy.steps.map(s=>s.replaceAll('индейки','курицы').replaceAll('индейку','курицу').replaceAll('410 г','400 г'));}
 if(tier===0 && ['w2turkey','w4turkey'].includes(id)) {copy.items.pork=400;delete copy.items.turkey;copy.title=copy.title.replace('Индейка','Свинина');copy.protein='Свинина';copy.steps=copy.steps.map(s=>s.replaceAll('индейки','свинины').replaceAll('индейку','свинину').replaceAll('410 г','400 г'));}
 if(tier===0 && id==='w3cutlet') {delete copy.items.mince;delete copy.items.porkmince;copy.items.liver=400;copy.items.egg=1;copy.items.flour=40;copy.title='Печёночные оладьи с булгуром и морковью';copy.protein='Печень';copy.note='Вторые 400 г из упаковки печени недели 2. Хранить замороженными, разморозить в холодильнике перед готовкой.';copy.steps=['400 г размороженной печени и 100 г лука очень мелко порубите ножом. Смешайте с 1 яйцом, 40 г муки, половиной соли и специями.','300 г моркови нарежьте брусочками и смажьте 5 г масла. Запекайте 25 минут при 200 °C.','140 г булгура сварите в 280 мл воды за 15 минут. На оставшихся 10 г масла испеките 8 небольших печёночных оладий по 3–4 минуты с каждой стороны; доведите под крышкой до 74 °C внутри.','Смешайте 100 г йогурта с 10 г горчицы. Каждому подайте 4 оладьи и половину булгура, моркови и соуса.'];}
 if(tier===0 && id==='w3pilaf') {copy.items.pork=copy.items.beef;delete copy.items.beef;copy.title=copy.title.replace('говядиной','свининой');copy.protein='Свинина';copy.steps=copy.steps.map(s=>s.replaceAll('говядины','свинины'));}
 if(tier===0 && id==='w3shrimp') {delete copy.items.shrimp;copy.items.egg=4;copy.items.cheese=60;copy.title='Салат с яйцом, сыром и кускусом';copy.protein='Яйца';copy.note='Эконом-вариант: креветки заменены яйцом и сыром, кускус остаётся 100 г на двоих. Креветочная версия доступна в бюджетах 25 и 30 тысяч.';copy.steps=['Ровно 100 г сухого кускуса залейте 120–150 мл кипятка по упаковке, накройте на 5 минут и разрыхлите вилкой.','4 яйца сварите вкрутую за 10 минут. Нарежьте 60 г сыра, 200 г огурцов, 2 помидора и 150 г перца.','Смешайте 100 г йогурта, 20 мл лимонного сока, 20 г масла, соль и специи.','Каждому положите половину кускуса (из 50 г сухого), 2 яйца, 30 г сыра и половину овощей и соуса.'];}
 if(tier===2 && ['w2pork','w4pork'].includes(id)) {copy.items.beef=copy.items.pork;delete copy.items.pork;copy.title=copy.title.replace('Свинина','Говядина');copy.steps=copy.steps.map(s=>s.replace('свинину','говядину').replace('свинины','говядины').replace('45–60 минут','75–90 минут'));copy.time=110;}
 if(tier===2 && id==='w4fish') {copy.items.salmon=copy.items.fish;delete copy.items.fish;copy.title=copy.title.replace('Горбуша','Лосось');}
 return tier===1?activeRecipe(copy):{...copy,portions:2};
}
export function calories(r){return Math.round(Object.entries(r.items).reduce((s,[id,q])=>s+ingredients[id].kcal*q,0)/(r.portions||2));}
export const weeks=[
 {label:'7–13 сентября',date:'2026-09-07',theme:'Сначала остатки',ids:['w1chicken','w1eggplant','w1tortilla','w1pasta','w1cutlet','w1oats','w1salad','w1bolognese','w1syrniki','w1toast','w1pork']},
 {label:'14–20 сентября',date:'2026-09-14',theme:'Тунец и домашняя классика',ids:['w2turkey','w2liver','w2tuna','w2pork','w2pizza','w2millet','w2salad','w2meatballs','w2eggs','w2pita','w2chicken']},
 {label:'21–27 сентября',date:'2026-09-21',theme:'Креветки без горы кускуса',ids:['w3chicken','w3pork','w3pasta','w3turkey','w3frittata','w3pancake','w3shrimp','w3cutlet','w3oats','w3toast','w3pilaf']},
 {label:'28 сентября – 4 октября',date:'2026-09-28',theme:'Рыба, ленивые голубцы и запеканка',ids:['w4chicken','w4fish','w4pork','w4cabbage','w4pasta','w4curd','w4salad','w4turkey','w4millet','w4pita','w4cutlet']}
];
export const slots=[['Пн','Ужин',0],['Вт','Ужин',1],['Ср','Ужин',2],['Чт','Ужин',3],['Пт','Ужин',4],['Сб','Завтрак',5],['Сб','Обед',5],['Сб','Ужин',5],['Вс','Завтрак',6],['Вс','Обед',6],['Вс','Ужин',6]];
export function extras(tier,week) {
 const e=[{title:'Фрукты Пн–Пт',items:{apple:2000},how:'По 200 г яблок каждому в Пн–Пт, например после ужина. Фрукты в самих рецептах посчитаны отдельно.'},{title:'Сок Пн / Ср / Пт',items:{juice:1000},how:'Пн и Ср: по 150 мл каждому; Пт: по 200 мл. Не вместо воды.'},{title:'Сырки Вт / Чт',items:{bar:4},how:'По 1 сырку 40 г каждому во Вт и Чт. При оставшейся домашней выпечке замените сырок порцией выпечки по её составу.'}];
 e.push({title:'Перекус выходных: овсянка с молоком и бананом',items:{oats:120,milk:1000,banana:600},how:'В Сб и Вс каждому: 30 г овсянки, 250 мл молока и 150 г мякоти банана. Хлопья сварить в молоке по упаковке, добавить банан. Можно разделить между основными приёмами по аппетиту. Это еда на день, а не обязательный четвёртый приём.'});
 if(tier===0||tier===1) {e[0].items.apple=1000;e[0].how='По 100 г яблок каждому в Пн–Пт. Это дополнение к овощам, а не полный дневной объём фруктов и овощей.';e[1].items.juice=500;e[1].title='Сок Пн / Пт';e[1].how='В Пн и Пт по 125 мл каждому; открытую упаковку хранить по этикетке. Если срок меньше, выпить в два соседних дня.';e[2].items.bar=2;e[2].title='Сырки во вторник';e[2].how='По 1 сырку 40 г каждому во вторник. В четверг отдельная сладость не предусмотрена.';}
 if(tier===2) {e[0].items.apple=1200;e[0].how='По 200 г яблок каждому в Пн, Вт и Чт. В Ср и Пт яблоки заменены ягодным йогуртом.';e.push({title:'Ягодный йогурт',items:{berries:600,yogurt:500},how:'В Ср и Пт вместо яблок: каждому по 150 г ягод и 125 г йогурта.'});e[2].items.bar=2;e[2].how='Во вторник по 1 сырку каждому. В четверг — орехи вместо сырка.';e.push({title:'Орехи к перекусу',items:{nuts:100},how:'Чт и Сб: по 25 г каждому, не дополнительная обязательная еда.'});}
 if(tier===1)e[1].how+=' При покупке 1 л неиспользованные 500 мл сразу заморозьте порциями для следующей недели; не храните открытую упаковку неделю дольше срока на этикетке.';
 return e;
}
export function calculate(tier=1,grainStock={}) {
 const inventory=Object.fromEntries(Object.values(ingredients).map(i=>[i.id,i.stock]));
 for(const id of ['rice','bulgur','couscous']) inventory[id]=Math.max(0,Number(grainStock[id])||0);
 const result=[];
 for(let w=0;w<4;w++) {
  const used={},alloc={}; const add=(id,q,label)=>{used[id]=(used[id]||0)+q;(alloc[id]??=[]).push([label,q]);};
  weeks[w].ids.forEach((id,j)=>Object.entries(recipeFor(id,tier).items).forEach(([key,q])=>add(key,q,`${slots[j][0]} ${slots[j][1]} · ${recipeFor(id,tier).title}`)));
  extras(tier,w).forEach(e=>Object.entries(e.items).forEach(([id,q])=>add(id,q,e.title)));
const rows=Object.entries(used).map(([id,q])=>{const i=ingredients[id],opening=inventory[id]||0;if(i.base)return {id,used:q,opening:null,purchase:0,cost:0,closing:null,alloc:alloc[id]};const count=Math.max(0,Math.ceil(Math.max(0,q-opening)/i.pack-1e-9)),purchase=count*i.pack,cost=count*i.price;inventory[id]=opening+purchase-q;return{id,used:q,opening,purchase,cost,closing:inventory[id],alloc:alloc[id]};});
  const food=rows.reduce((s,r)=>s+r.cost,0),delivery=tier===1?0:[0,200,400][tier],base=w===0?(tier===0?600:800):0,bufferRate=tier===1?.05:.1,buffer=Math.ceil((food+base)*bufferRate),total=food+delivery+base+buffer;
  result.push({rows,food,delivery,base,bufferRate,buffer,total,remaining:{...inventory}});
 }
 return {weeks:result,total:result.reduce((s,w)=>s+w.total,0),food:result.reduce((s,w)=>s+w.food,0)};
}
