"use client";

import { useEffect, useMemo, useState } from "react";
import { recipeDetails } from "./recipe-details";

type Expense = { name: string; category: string; amount: number; source: string };
type Recipe = { time: string; portions: string; ingredients: string[]; steps: string[]; note?: string };
type Meal = { day: string; type: string; title: string; batch: string; recipe: Recipe };
type ShopItem = { category: string; name: string; quantity: string; price: number };
type Week = { number: number; title: string; focus: string; variety: string[]; prep: string[]; meals: Meal[]; shopping: ShopItem[] };

const rubles = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rounded = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const exact = (value: number) => `${rubles.format(value)} ₽`;
const money = (value: number) => `${rounded.format(Math.round(value))} ₽`;
const total = (items: ShopItem[]) => items.reduce((sum, item) => sum + item.price, 0);
const split = (value: string) => value.split("|").map((part) => part.trim());
const meal = (day: string, type: string, title: string, batch: string, time: string, ingredients: string, steps: string, note?: string): Meal => ({
  day, type, title, batch,
  recipe: { time, portions: batch.split("·")[0].trim(), ingredients: split(ingredients), steps: split(steps), note },
});
const shop = (category: string, name: string, quantity: string, price: number): ShopItem => ({ category, name, quantity, price });

const expenses: Expense[] = [
  { source: "09.08", name: "Филе и печень из стартового чека", category: "Белок", amount: 657.78 },
  { source: "09.08", name: "Куриные голени, 6 шт.", category: "Белок", amount: 300 },
  { source: "09.08", name: "Овощи, фрукты и зелень из стартового чека", category: "Овощи и фрукты", amount: 509.29 },
  { source: "09.08", name: "Лисички и овощная заморозка", category: "Овощи и фрукты", amount: 389.98 },
  { source: "09.08", name: "Морковь, 700 г", category: "Овощи и фрукты", amount: 56 },
  { source: "09.08", name: "Молочное и яйца из стартового чека", category: "Молочное и яйца", amount: 911.93 },
  { source: "09.08", name: "Гречка, овсянка, кетчуп и пудра", category: "Бакалея", amount: 429.96 },
  { source: "13.08 · чек", name: "Спагетти Barilla, 450 г", category: "Бакалея", amount: 94.99 },
  { source: "13.08 · чек", name: "Шампиньоны вместо лисичек, 250 г", category: "Овощи и фрукты", amount: 82.99 },
  { source: "13.08 · чек", name: "Фетакса, 200 г", category: "Молочное и яйца", amount: 159.99 },
  { source: "13.08 · чек", name: "Фарш свинина + говядина, 400 г", category: "Белок", amount: 179.99 },
  { source: "13.08 · чек", name: "Фарш говяжий, 400 г", category: "Белок", amount: 314.99 },
  { source: "13.08 · чек", name: "Дрожжевое тесто, 500 г", category: "Бакалея", amount: 119.99 },
  { source: "13.08 · чек", name: "Красный перец, 124 г", category: "Овощи и фрукты", amount: 34.72 },
  { source: "15.08 · скрин", name: "Глазированные сырки, 4 шт.", category: "Удовольствия", amount: 119.96 },
  { source: "15.08 · скрин", name: "Нектарины, 650 г", category: "Овощи и фрукты", amount: 116.58 },
  { source: "Неделя 1", name: "Мармелад Bon Pari", category: "Удовольствия", amount: 59.95 },
  { source: "Неделя 1", name: "Kinder Молочный ломтик, 5 шт.", category: "Удовольствия", amount: 300 },
  { source: "Неделя 1", name: "Молоко, 1,7 л", category: "Молочное и яйца", amount: 209.9 },
];

const stock = [
  ["Яйца", "13 шт."], ["Фетакса", "до 200 г — проверить остаток"], ["Фарш свинина + говядина", "1 уп., 400 г"],
  ["Молоко", "1 л"], ["Рис", "2 пакетика"], ["Гречка", "3 пакетика"], ["Овсянка", "600 г"],
  ["Семена льна", "100 г"], ["Манка", "600 г"], ["Яичная лапша", "400 г"],
  ["Свиные эскалопы", "4 шт., заморожены"], ["Кетчуп", "200 г"],
];

const baseWeeks: Week[] = [
  {
    number: 2,
    title: "Сначала используем остатки",
    focus: "Эскалопы, фарш, крупы и молоко уходят в начале недели; рыба остаётся одним свежим ужином.",
    variety: ["Гречка", "Рис", "Яичная лапша", "Картофель"],
    prep: ["В понедельник разморозить только 4 эскалопа.", "Во вторник приготовить всю рыбу и не оставлять её на завтра.", "В среду использовать всю яичную лапшу, в четверг — упаковку фарша.", "Фахитас сделать на 4 порции: две оставить на воскресный обед."],
    meals: [
      meal("Понедельник", "Ужин", "Эскалопы с гречкой и салатом", "2 порции · из запаса", "35 мин", "Свиные эскалопы — 4 шт. из запаса|Гречка — 2 пакетика из запаса|Огурцы — 300 г|Помидоры — 300 г|Йогурт — 80 г", "Сварите гречку.|Эскалопы обжарьте по 3–4 минуты с каждой стороны и дайте отдохнуть 5 минут.|Нарежьте салат и разделите всё поровну."),
      meal("Вторник", "Ужин", "Форель с рисом и брокколи", "2 порции · без хранения", "30 мин", "Форель — 600 г|Рис — 2 пакетика из запаса|Брокколи — 500 г|Лимон — 1/2 шт.|Масло — 10 мл", "Сварите рис.|Рыбу сбрызните лимоном и запекайте 14–18 минут при 200 °C.|Брокколи приготовьте на пару и подайте сразу."),
      meal("Среда", "Ужин", "Яичная лапша с курицей и овощами", "3 порции · одна в ланч-бокс", "30 мин", "Куриное филе — 450 г|Яичная лапша — 400 г из запаса|Перец — 250 г|Морковь — 150 г|Лук — 1 шт.|Соевый соус — 35 мл", "Лапшу сварите на минуту меньше инструкции.|Курицу обжарьте 6 минут, добавьте овощи ещё на 5 минут.|Добавьте лапшу и соус; третью порцию уберите в контейнер."),
      meal("Четверг", "Ужин", "Котлеты, картофель и капустный салат", "3 порции · фарш из запаса", "45 мин", "Фарш свинина + говядина — 400 г|Картофель — 700 г|Яйцо — 1 шт. из запаса|Капуста — 350 г|Морковь — 100 г|Кетчуп — 60 г", "Смешайте фарш с яйцом и сформируйте 6 котлет.|Картофель запекайте 35 минут, котлеты доведите до полной готовности.|Сделайте капустный салат; одну порцию отложите."),
      meal("Пятница", "Ужин", "Фриттата с Фетаксой и овощами", "2 порции · 6 яиц из запаса", "30 мин", "Яйца — 6 шт. из запаса|Фетакса — 100 г из запаса|Картофель — 300 г|Помидоры — 300 г|Перец — 150 г", "Картофель тонко нарежьте и доведите почти до готовности.|Добавьте овощи и взбитые яйца.|Раскрошите Фетаксу сверху и готовьте под крышкой 8–10 минут."),
      meal("Суббота", "Завтрак", "Манная каша с бананом", "2 порции · крупа из запаса", "15 мин", "Манка — 120 г из запаса|Молоко — 600 мл из запаса|Банан — 250 г|Корица — по желанию", "Молоко доведите почти до кипения.|Тонкой струйкой всыпьте манку и варите 4–5 минут, помешивая.|Добавьте банан в тарелки."),
      meal("Суббота", "Обед", "Греческий салат с Фетаксой и питой", "2 порции", "15 мин", "Фетакса — 100 г из запаса|Огурцы — 300 г|Помидоры — 300 г|Перец — 150 г|Питы — 2 шт.", "Овощи нарежьте крупно.|Добавьте Фетаксу и заправку.|Питы прогрейте на сухой сковороде.", "Если Фетаксы осталось меньше 200 г на всю неделю, докупите только разницу."),
      meal("Суббота", "Ужин", "Куриные фахитас", "4 порции · половина на воскресенье", "35 мин", "Куриное филе — 550 г|Тортильи — 8 шт.|Перец — 300 г|Лук — 2 шт.|Помидоры — 200 г|Сыр — 120 г|Йогурт — 120 г", "Курицу и овощи обжарьте до полной готовности.|Разложите начинку и сыр по тортильям.|Половину остудите и уберите на воскресный обед."),
      meal("Воскресенье", "Завтрак", "Овсяно-творожные панкейки с льном", "2 порции · крупы из запаса", "25 мин", "Овсянка — 180 г из запаса|Лён — 30 г из запаса|Творог — 400 г|Яйца — 2 шт. из запаса|Молоко — 250 мл из запаса|Банан — 200 г", "Измельчите половину овсянки и смешайте ингредиенты.|Дайте тесту постоять 7 минут.|Жарьте панкейки по 2–3 минуты с каждой стороны."),
      meal("Воскресенье", "Обед", "Фахитас из субботней заготовки", "2 порции · без новой готовки", "10 мин", "Фахитас — 4 шт. из заготовки|Огурцы и помидоры — 300 г|Йогурт — 80 г", "Прогрейте фахитас до горячего центра.|Нарежьте овощи.|Подайте с йогуртом; повторно не замораживайте."),
      meal("Воскресенье", "Ужин", "Курица с картофелем на одном противне", "3 порции · одна на понедельник", "50 мин", "Куриное филе — 500 г|Картофель — 800 г|Овощная смесь — 600 г|Лук — 1 шт.|Лимон — 1/2 шт.", "Картофель и лук запекайте 15 минут при 200 °C.|Добавьте курицу и овощи ещё на 25–30 минут.|Третью порцию остудите и уберите в контейнер."),
    ],
    shopping: [
      shop("Белок", "Форель", "600 г", 580), shop("Белок", "Куриное филе", "1,5 кг", 650),
      shop("Молочное", "Творог, сыр, натуральный йогурт", "400 г + 250 г + 500 г", 610), shop("Молочное", "Молоко", "1,8 л сверх остатка", 220),
      shop("Овощи", "Картофель", "2 кг", 160), shop("Овощи", "Брокколи и овощная смесь", "500 г + 600 г", 330),
      shop("Овощи", "Помидоры, огурцы, сладкий перец", "1,2 кг + 1 кг + 700 г", 790), shop("Овощи", "Капуста, лук, морковь", "700 г + 1 кг + 700 г", 230),
      shop("Фрукты", "Бананы, яблоки, нектарины", "2 кг", 420), shop("Овощи", "Зелень, чеснок и лимон", "1 набор", 150),
      shop("Бакалея", "Тортильи, питы и хлеб", "8 шт. + 2 шт. + 1 буханка", 370), shop("Бакалея", "Пассата, соевый соус и специи", "500 г + 1 набор", 220),
      shop("Удовольствия", "Сок, 4 молочных десерта и мармелад", "1,5 л + 4 шт. + 1 уп.", 430), shop("Доставка", "Слот и пакеты", "1 заказ", 100),
    ],
  },
  {
    number: 3,
    title: "Разные крупы и ужин с креветками",
    focus: "Рис остаётся только в воскресном плове; в остальные дни чередуются гречка, кускус, паста, картофель и сытный салат с морепродуктами.",
    variety: ["Гречка", "Кускус", "Паста", "Рис × 1", "Креветки"],
    prep: ["Запечь курицу с гречкой только на понедельник.", "Для перцев во вторник запарить кускус, варить его заранее не нужно.", "Креветки для пятничного салата разморозить в холодильнике и готовить прямо перед ужином.", "Пирог сделать на 3 порции: одна остаётся на воскресенье."],
    meals: [
      meal("Понедельник", "Ужин", "Запечённая курица с гречкой и овощами", "3 порции", "50 мин", "Курица — 700 г|Гречка — 220 г|Овощи — 700 г|Лук — 1 шт.", "Запеките курицу с овощами.|Отдельно сварите гречку до рассыпчатости.|Разделите всё на 3 порции."),
      meal("Вторник", "Ужин", "Перцы с индейкой и кускусом", "3 порции · одна в ланч-бокс", "55 мин", "Фарш индейки — 350 г|Перец — 600 г|Кускус — 120 г|Пассата — 300 г|Сыр — 80 г", "Запарьте кускус.|Смешайте его с фаршем и наполните перцы.|Запекайте в пассате, в конце добавьте сыр."),
      meal("Среда", "Ужин", "Куриная паста с томатами", "2 порции", "30 мин", "Куриное филе — 350 г|Паста — 260 г|Пассата — 350 г|Помидоры — 250 г|Сыр — 60 г", "Сварите пасту al dente.|Курицу обжарьте, добавьте томаты на 10 минут.|Смешайте с пастой и сыром."),
      meal("Четверг", "Ужин", "Боул с котлетой, картофелем и капустой", "2 порции", "45 мин", "Фарш — 350 г|Картофель — 700 г|Капуста — 400 г|Морковь — 100 г|Йогурт — 100 г", "Сформируйте 4 котлеты и приготовьте полностью.|Картофель запеките дольками.|Сделайте салат и йогуртовый соус."),
      meal("Пятница", "Ужин", "Тёплый салат с креветками и белой фасолью", "2 порции", "25 мин", "Креветки очищенные — 400 г|Белая фасоль — 240 г без жидкости|Салатные листья — 200 г|Огурцы — 300 г|Помидоры — 300 г|Хлеб — 100 г|Йогурт — 100 г|Лимон — 1/2 шт.|Горчица — 10 г", "Подсушите хлеб и приготовьте креветки.|Смешайте овощи, листья и фасоль.|Добавьте тёплые креветки и йогуртовую заправку."),
      meal("Суббота", "Завтрак", "Яйца, тост и помидоры", "2 порции", "15 мин", "Яйца — 4 шт.|Хлеб — 4 ломтика|Помидоры — 300 г|Творог — 200 г", "Приготовьте яйца.|Подсушите хлеб.|Подайте с творогом и помидорами."),
      meal("Суббота", "Обед", "Домашний цезарь с курицей", "2 порции", "20 мин", "Курица — 300 г|Салатные листья — 250 г|Яйца — 2 шт.|Хлеб — 100 г|Сыр — 60 г|Йогурт — 100 г", "Подсушите хлеб, яйца сварите.|Смешайте листья, курицу и заправку.|Добавьте яйца, сухарики и сыр."),
      meal("Суббота", "Ужин", "Картофельный пирог с курицей", "3 порции · одна на воскресенье", "60 мин", "Тесто — 500 г|Курица — 400 г|Картофель — 600 г|Овощи — 300 г|Яйцо — 1 шт.|Сыр — 80 г", "Картофель доведите до полуготовности.|Соберите пирог с курицей, овощами и сыром.|Смажьте яйцом и выпекайте 35–40 минут при 190 °C."),
      meal("Воскресенье", "Завтрак", "Овсянка с творогом, бананом и льном", "2 порции · крупы из запаса", "15 мин", "Овсянка — 180 г из запаса|Лён — 20 г из запаса|Молоко — 400 мл|Творог — 300 г|Банан — 250 г", "Сварите овсянку.|Вмешайте молотый лён.|Добавьте творог и банан в тарелки."),
      meal("Воскресенье", "Обед", "Остаток пирога и большой салат", "2 порции", "12 мин", "Пирог — 2 порции|Огурцы и помидоры — 500 г|Йогурт — 80 г", "Пирог прогрейте.|Овощи нарежьте.|Подайте с йогуртовой заправкой."),
      meal("Воскресенье", "Ужин", "Куриный плов с овощами", "3 порции · одна на понедельник", "50 мин", "Курица — 500 г|Рис — 240 г|Морковь — 250 г|Лук — 2 шт.|Овощная смесь — 300 г", "Курицу подрумяньте с овощами.|Добавьте рис и воду по инструкции.|Томите до готовности; третью порцию уберите."),
    ],
    shopping: [
      shop("Белок", "Целая курица + куриное филе", "2,4 кг", 1050), shop("Белок", "Фарш индейки/говядины", "700 г", 550),
      shop("Морепродукты", "Очищенные креветки", "400 г", 550), shop("Бакалея", "Белая фасоль", "1 банка", 100),
      shop("Молочное", "Яйца С1", "10 шт. сверх остатка", 150), shop("Молочное", "Творог и сыр", "500 г + 300 г", 450),
      shop("Молочное", "Молоко и йогурт", "1,7 л + 700 г", 350), shop("Овощи", "Картофель, лук и морковь", "4 кг", 300),
      shop("Овощи", "Замороженные овощи", "1 кг", 220), shop("Овощи", "Помидоры, огурцы, перец и капуста", "3,5 кг", 575),
      shop("Фрукты", "Фрукты", "2,7 кг", 520), shop("Бакалея", "Гречка, кускус, рис и паста", "250 г + 250 г + 300 г + 500 г", 430),
      shop("Бакалея", "Хлеб", "1 буханка", 120), shop("Бакалея", "Тесто для пирога", "500 г", 120),
      shop("Бакалея", "Пассата, соусы, горчица и специи", "1 набор", 270), shop("Овощи", "Салатные листья, зелень и лимон", "500 г + 1 набор", 220),
      shop("Удовольствия", "Сок и 4 молочных десерта", "1,5 л + 4 шт.", 450), shop("Доставка", "Слот и пакеты", "1 заказ", 100),
    ],
  },
  {
    number: 4,
    title: "Пять гарниров и салат с кальмаром",
    focus: "За неделю по одному разу появляются рис, булгур, паста, кускус и гречка; картофель остаётся только в двух блюдах, а пятничный ужин — морской салат.",
    variety: ["Рис × 1", "Булгур", "Паста", "Кускус", "Гречка", "Кальмар"],
    prep: ["Рыбу готовить только в понедельник, печень — во вторник.", "Кебабы замариновать утром среды.", "Кальмар разморозить в холодильнике и готовить не дольше указанного времени.", "Запеканку сразу разделить: две порции оставить на воскресный обед."],
    meals: [
      meal("Понедельник", "Ужин", "Форель с рисом и зелёными овощами", "2 порции", "30 мин", "Форель — 600 г|Рис — 180 г|Зелёные овощи — 500 г|Лимон — 1/2 шт.", "Сварите рис.|Рыбу запекайте 14–18 минут.|Овощи приготовьте на пару и подайте сразу."),
      meal("Вторник", "Ужин", "Печень с пюре и салатом", "2 порции", "35 мин", "Печень — 450 г|Картофель — 800 г|Молоко — 200 мл|Лук — 1 шт.|Огурцы и помидоры — 400 г", "Сварите картофель и сделайте пюре.|Лук обжарьте, печень готовьте 7–8 минут и посолите в конце.|Подайте с салатом."),
      meal("Среда", "Ужин", "Куриные кебабы с булгуром", "3 порции · одна в ланч-бокс", "40 мин", "Куриное филе — 600 г|Булгур — 240 г|Перец — 300 г|Лук — 2 шт.|Йогурт — 120 г", "Замаринуйте курицу в специях и части йогурта.|Приготовьте кебабы до полной готовности.|Сварите булгур и отложите третью порцию."),
      meal("Четверг", "Ужин", "Паста-запеканка с индейкой", "3 порции", "50 мин", "Фарш индейки — 500 г|Паста — 320 г|Пассата — 500 г|Овощи — 400 г|Сыр — 160 г", "Пасту сварите до полуготовности, фарш обжарьте.|Смешайте с овощами, пассатой и половиной сыра.|Запекайте 20 минут, сверху добавьте сыр."),
      meal("Пятница", "Ужин", "Тёплый салат с кальмаром и кускусом", "2 порции", "30 мин", "Филе кальмара — 500 г|Кускус — 180 г|Огурцы — 300 г|Помидоры — 300 г|Перец — 200 г|Салатные листья — 150 г|Йогурт — 120 г|Лимон — 1/2 шт.|Горчица — 10 г", "Запарьте кускус.|Быстро обжарьте кальмара.|Смешайте с овощами, листьями и йогуртовой заправкой."),
      meal("Суббота", "Завтрак", "Запечённая овсянка с творогом и яблоком", "2 порции · овсянка из запаса", "40 мин", "Овсянка — 180 г из запаса|Творог — 400 г|Яйца — 2 шт.|Молоко — 250 мл|Яблоки — 400 г", "Смешайте ингредиенты.|Переложите в форму.|Запекайте 28–32 минуты при 180 °C."),
      meal("Суббота", "Обед", "Горячие сэндвичи с курицей", "2 порции", "20 мин", "Курица — 300 г|Хлеб — 6 ломтиков|Сыр — 120 г|Овощи — 400 г|Йогурт — 80 г", "Соберите сэндвичи.|Прогрейте до расплавления сыра.|Подайте с овощами."),
      meal("Суббота", "Ужин", "Овощная запеканка с индейкой", "4 порции · две на воскресенье", "60 мин", "Фарш индейки — 450 г|Картофель — 600 г|Овощи — 900 г|Яйцо — 1 шт.|Сыр — 140 г", "Фарш быстро обжарьте.|Соберите запеканку слоями.|Готовьте 40–45 минут; две порции оставьте."),
      meal("Воскресенье", "Завтрак", "Шакшука с хлебом", "2 порции", "30 мин", "Яйца — 6 шт.|Томаты — 500 г|Перец — 200 г|Лук — 1 шт.|Хлеб — 4 ломтика|Сыр — 60 г", "Лук и перец обжарьте, добавьте томаты.|Разбейте яйца в углубления.|Готовьте под крышкой и добавьте сыр."),
      meal("Воскресенье", "Обед", "Остаток запеканки и салат", "2 порции", "12 мин", "Запеканка — 2 порции|Огурцы и помидоры — 500 г|Йогурт — 80 г", "Запеканку хорошо прогрейте.|Овощи нарежьте.|Подайте с йогуртовой заправкой."),
      meal("Воскресенье", "Ужин", "Курица с гречкой, грибами и стручковой фасолью", "3 порции · одна на понедельник", "45 мин", "Куриное филе — 500 г|Гречка — 220 г|Шампиньоны — 400 г|Стручковая фасоль — 400 г|Лук — 1 шт.|Йогурт — 100 г|Горчица — 10 г", "Сварите рассыпчатую гречку.|Обжарьте курицу, грибы и фасоль.|Добавьте йогуртово-горчичный соус и разделите на 3 порции."),
    ],
    shopping: [
      shop("Белок", "Форель", "600 г", 650), shop("Белок", "Куриное филе", "1,5 кг", 680), shop("Белок", "Печень", "450 г", 280),
      shop("Белок", "Фарш индейки", "1 кг", 600), shop("Морепродукты", "Филе кальмара", "500 г", 450),
      shop("Молочное", "Яйца С1", "10 шт.", 150), shop("Молочное", "Творог и сыр", "400 г + 500 г", 650),
      shop("Молочное", "Молоко и йогурт", "1,7 л + 700 г", 350), shop("Овощи", "Картофель, лук, морковь и капуста", "3,5 кг", 300),
      shop("Овощи", "Помидоры, огурцы, перец и зелень", "3,6 кг", 650), shop("Овощи", "Шампиньоны и стручковая фасоль", "400 г + 400 г", 350),
      shop("Овощи", "Замороженные овощи", "1,5 кг", 330), shop("Фрукты", "Фрукты", "2,2 кг", 400),
      shop("Бакалея", "Рис, булгур, паста, кускус и гречка", "250 г + 250 г + 500 г + 250 г + 250 г", 500),
      shop("Бакалея", "Хлеб", "1 буханка", 150), shop("Бакалея", "Пассата, специи, горчица и лимон", "1 набор", 220),
      shop("Удовольствия", "Сок и 4 молочных десерта", "1,5 л + 4 шт.", 330), shop("Доставка", "Слот и пакеты", "1 заказ", 100),
    ],
  },
];

const recipeCount = baseWeeks.reduce((sum, week) => sum + week.meals.length, 0);
if (Object.keys(recipeDetails).length !== recipeCount) {
  throw new Error(`Ожидалось ${recipeCount} подробных рецептов, получено ${Object.keys(recipeDetails).length}.`);
}

const weeks: Week[] = baseWeeks.map((week) => ({
  ...week,
  meals: week.meals.map((item) => {
    const details = recipeDetails[`${week.number}:${item.title}`];
    if (!details || details.steps.length < 5) {
      throw new Error(`Нет полного пошагового рецепта: неделя ${week.number}, ${item.title}.`);
    }
    return {
      ...item,
      recipe: {
        ...item.recipe,
        ingredients: [...item.recipe.ingredients, ...(details.addIngredients ?? [])],
        steps: details.steps,
        note: details.note ?? item.recipe.note,
      },
    };
  }),
}));

const budget = 25_000;
const mascarponeOutsidePlan = 229.99;
const confirmedTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
const futureTotal = weeks.reduce((sum, week) => sum + total(week.shopping), 0);
const baseMonth = confirmedTotal + futureTotal;
const forecastLow = baseMonth + 1_600;
const forecastHigh = baseMonth + 2_500;
const forecastOverLow = Math.max(0, forecastLow - budget);
const forecastOverHigh = Math.max(0, forecastHigh - budget);

export default function Home() {
  const [weekNumber, setWeekNumber] = useState(2);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [copyLabel, setCopyLabel] = useState("Скопировать список");
  const current = weeks.find((week) => week.number === weekNumber) ?? weeks[0];
  const currentTotal = total(current.shopping);

  const categories = useMemo(() => {
    const result = new Map<string, number>();
    expenses.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + item.amount));
    return [...result.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const maxCategory = Math.max(...categories.map(([, value]) => value));

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("modal-open"); };
  }, [selected]);

  async function copyShopping() {
    const content = [`Неделя ${current.number}: ${current.title}`, "", ...current.shopping.map((item) => `${item.name} — ${item.quantity} — ${money(item.price)}`), "", `Итого: ${money(currentTotal)}`].join("\n");
    try { await navigator.clipboard.writeText(content); setCopyLabel("Список скопирован"); }
    catch { setCopyLabel("Скопируйте вручную"); }
    window.setTimeout(() => setCopyLabel("Скопировать список"), 1800);
  }

  return (
    <>
      <header className="topbar"><div className="shell topbar-inner"><a className="brand" href="#top"><span className="brand-mark">ПР</span><span>Петербургский рацион</span></a><nav><a href="#fact">Факт</a><a href="#stock">Остатки</a><a href="#weeks">Недели 2–4</a></nav><span className="location">Санкт-Петербург</span></div></header>
      <main id="top">
        <section className="hero shell">
          <div className="hero-copy"><span className="eyebrow">Обновлено 15 августа · больше разнообразия</span><h1>Питание на месяц для двоих</h1><p>Один бюджет, фактические чеки и пересобранные недели 2–4. На неделях 3–4 рис появляется не чаще одного раза, а в меню добавлены разные крупы и два ужина с морепродуктами.</p></div>
          <aside className="budget-card"><div className="budget-head"><span>Текущий бюджет</span><strong>{money(budget)}</strong></div><div className="meter"><span style={{ width: `${Math.min(100, baseMonth / budget * 100)}%` }} /></div><div className="budget-numbers"><div><span>По точным спискам</span><strong>{exact(baseMonth)}</strong></div><div><span>Реалистичный итог</span><strong>{money(forecastLow)}–{money(forecastHigh)}</strong></div></div><p>Прогноз уже включает креветки, кальмара и дополнительные крупы. Повторные докупки молока и десертов учтены диапазоном, повторную порчу не закладываем.</p></aside>
        </section>

        <section className="section shell" id="fact">
          <div className="section-heading"><div><span className="eyebrow">Неделя 1</span><h2>Что потрачено на самом деле</h2></div><p>Оба приложенных чека и три сообщённые докупки внесены без задвоения теста для пиццы.</p></div>
          <div className="stats">
            <article className="stat stat-primary"><span>Подтверждено для рациона</span><strong>{exact(confirmedTotal)}</strong><small>Минимальная точная сумма: двух цен ещё нет.</small></article>
            <article className="stat"><span>Оплачено всего</span><strong>{exact(confirmedTotal + mascarponeOutsidePlan)}</strong><small>Включая маскарпоне 229,99 ₽ вне плана.</small></article>
            <article className="stat"><span>Следующие 3 недели</span><strong>{money(futureTotal)}</strong><small>5 260 ₽ + 6 525 ₽ + 7 140 ₽.</small></article>
            <article className="stat"><span>Базовый резерв</span><strong>{exact(budget - baseMonth)}</strong><small>До двух неизвестных цен и новых докупок.</small></article>
          </div>
          <div className="fact-grid">
            <article className="panel"><div className="panel-head"><h3>На что ушли деньги</h3><span>подтверждённые суммы</span></div><div className="category-list">{categories.map(([name, value]) => <div className="category" key={name}><div><span>{name}</span><strong>{exact(value)}</strong></div><div className="track"><span style={{ width: `${value / maxCategory * 100}%` }} /></div></div>)}</div></article>
            <div className="notes">
              <article className="note warning"><span>Не доказано</span><h3>Точный итог недели</h3><p>Нет цены картофеля 1,7 кг и шести крупных помидоров. Они пока не входят в 5 048,99 ₽.</p></article>
              <article className="note"><span>Списание</span><h3>Лисички и часть зелени</h3><p>Цена лисичек скрыта в общей строке 389,98 ₽, поэтому точный убыток не доказан. Замена шампиньонами — 82,99 ₽.</p></article>
              <article className="note success"><span>Выходные</span><h3>Меню скорректировано</h3><p>Двойные панкейки — субботний обед и вероятный ужин. В воскресенье омлет, затем болоньезе на обед и ужин; котлеты переносятся.</p></article>
            </div>
          </div>
          <details className="expenses"><summary>Все подтверждённые покупки</summary><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Позиция</th><th>Категория</th><th>Сумма</th></tr></thead><tbody>{expenses.map((item) => <tr key={`${item.source}-${item.name}`}><td data-label="Источник">{item.source}</td><td data-label="Позиция">{item.name}</td><td data-label="Категория">{item.category}</td><td data-label="Сумма">{exact(item.amount)}</td></tr>)}</tbody></table></div></details>
        </section>

        <section className="section tint" id="stock"><div className="shell"><div className="section-heading"><div><span className="eyebrow">Старт недели 2</span><h2>Что уже есть дома</h2></div><p>Всё ниже вычтено из новой корзины. Испорченную зелень в остаток не переносим.</p></div><div className="stock-grid">{stock.map(([name, value]) => <div className="stock-item" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div><p className="footnote">Если после воскресенья останется пицца, используйте её как отдельный обед в понедельник. В расчёт она не включена: в итоговом перечне остатков её нет.</p></div></section>

        <section className="section shell" id="weeks">
          <div className="section-heading"><div><span className="eyebrow">План дальше</span><h2>Недели 2–4</h2></div><p>На неделях 3–4 рис — максимум один раз; остальные гарниры чередуются, количества учитывают домашний запас.</p></div>
          <div className="tabs" role="tablist">{weeks.map((week) => <button type="button" role="tab" aria-selected={week.number === current.number} className={week.number === current.number ? "active" : ""} key={week.number} onClick={() => setWeekNumber(week.number)}><span>Неделя {week.number}</span><strong>{money(total(week.shopping))}</strong></button>)}</div>
          <div className="week-head"><div><span>0{current.number}</span><div><h3>{current.title}</h3><p>{current.focus}</p></div></div><button type="button" className="secondary" onClick={copyShopping}>{copyLabel}</button></div>
          <div className="variety" aria-label={`Разнообразие недели ${current.number}`}><strong>В ротации</strong>{current.variety.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="week-grid"><div><div className="subhead"><h3>Меню</h3><span>Нажмите на блюдо — внутри точные количества и 5–7 шагов</span></div><div className="meal-list">{current.meals.map((item, index) => <button className="meal" type="button" key={`${item.day}-${index}`} onClick={() => setSelected(item)}><span className="day">{item.day}<small>{item.type}</small></span><span className="dish">{item.title}<small>{item.batch}</small></span><span className="open">Рецепт</span></button>)}</div></div><aside className="prep"><span>Подготовка недели</span><ol>{current.prep.map((item) => <li key={item}>{item}</li>)}</ol></aside></div>
          <div className="shopping"><div className="shopping-head"><div><h3>Закупка на неделю {current.number}</h3><p>Чистый список: только то, чего не хватает после остатков.</p></div><strong>{money(currentTotal)}</strong></div><div className="table-wrap"><table><thead><tr><th>Раздел</th><th>Что купить</th><th>Количество</th><th>Ориентир</th></tr></thead><tbody>{current.shopping.map((item, index) => <tr key={`${item.name}-${index}`}><td data-label="Раздел">{item.category}</td><td data-label="Что купить">{item.name}</td><td data-label="Количество">{item.quantity}</td><td data-label="Ориентир">{money(item.price)}</td></tr>)}</tbody></table></div></div>
        </section>

        <section className="section forecast"><div className="shell forecast-card"><div><span className="eyebrow">Прогноз месяца</span><h2>{money(forecastLow)}–{money(forecastHigh)}</h2><p>{forecastLow > budget ? `При более разнообразном меню лимит, вероятнее всего, будет превышен на ${money(forecastOverLow)}–${money(forecastOverHigh)}.` : "Лимит 25 000 ₽ сохраняется с небольшим резервом."}</p></div><div className="forecast-weeks"><div><span>Неделя 1 · факт</span><strong>{exact(confirmedTotal)}</strong></div>{weeks.map((week) => <div key={week.number}><span>Неделя {week.number} · план</span><strong>{money(total(week.shopping))}</strong></div>)}</div><p className="method"><strong>Факт:</strong> 5 048,99 ₽ подтверждено. <strong>Вывод:</strong> разнообразие с креветками и кальмаром повышает плановую корзину. <strong>Гипотеза:</strong> при повторении молока и десертов, но без новой порчи, месяц завершится в этом диапазоне.</p></div></section>
      </main>
      <footer><div className="shell">Петербургский рацион · расчёт для двоих · август 2026</div></footer>

      {selected && <div className="backdrop"><button className="backdrop-dismiss" type="button" aria-label="Закрыть рецепт" onClick={() => setSelected(null)} /><section className="recipe" role="dialog" aria-modal="true" aria-labelledby="recipe-title"><div className="recipe-head"><div><span>{selected.day} · {selected.type}</span><h2 id="recipe-title">{selected.title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => setSelected(null)}>×</button></div><div className="recipe-meta"><span>{selected.recipe.time}</span><span>{selected.recipe.steps.length} шагов</span><span>{selected.batch}</span></div><div className="recipe-guide"><strong>Готовьте по порядку</strong><span>Все количества рассчитаны на {selected.recipe.portions}; нужные граммы повторяются прямо в шагах.</span></div><div className="recipe-body"><div><h3>Ингредиенты на {selected.recipe.portions}</h3><ul>{selected.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Пошаговое приготовление</h3><ol>{selected.recipe.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></div>{selected.recipe.note && <p className="recipe-note">{selected.recipe.note}</p>}</section></div>}
    </>
  );
}
