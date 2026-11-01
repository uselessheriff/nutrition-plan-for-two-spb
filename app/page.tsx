"use client";
import {confirmedStock,week12ActualItems,week12Household} from "./november-stock-data";
import "./compact-workspace.css";
import { useEffect, useRef, useState } from "react";
import { baseWeeks, expenses, weekFourPurchases, type Meal, type Week } from "./plan-data";
import { recipeDetails } from "./recipe-details";
import { futureMenuWeeks, futureExtras, futureWeekTotals, futurePlanTotal, futureConfirmedTotal, futureCurrentCycleActual, futureRemainingTotal, futureWeekFiveOutcomes } from "./future-plan-data";
import { novemberMenuWeeks, novemberMenuExtras, novemberTotal } from "./november-plan-data";
import { getMealHistoryByMenuKey, getWeekMealHistory, mealOutcomeLabels, mealPreferenceLabels, weekMealHistoryNotes, weekMealHistorySummaries, type MealHistoryWeek, type MealOutcome, type MealPreference } from "./meal-history";
import { fetchNetworkNow, formatPlanWeekRange, getPlanCalendar, millisecondsUntilNextMoscowMidnight, PLAN_WEEK_RANGES, type ClockSource } from "./plan-calendar";

const money = (value: number) => new Intl.NumberFormat("ru-RU", {maximumFractionDigits:2}).format(value) + " ₽";
const budget = 25_000;
const recipeCount = baseWeeks.reduce((sum,week)=>sum+week.meals.length,0);
if (Object.keys(recipeDetails).length !== recipeCount) throw new Error("Неполный архив рецептов");
const historicalWeeks: Week[] = baseWeeks.map(week=>({...week,meals:week.meals.map(meal=>{
 const details=recipeDetails[`${week.number}:${meal.title}`];
 if(!details) throw new Error("Нет рецепта "+meal.title);
 return {...meal,recipe:{...meal.recipe,ingredients:[...meal.recipe.ingredients,...(details.addIngredients??[])],steps:details.steps,note:details.note??meal.recipe.note}};
})}));
const menuWeeks=[...historicalWeeks,...futureMenuWeeks,...novemberMenuWeeks];
const historicalTotals=historicalWeeks.map(week=>week.number===4?weekFourPurchases.reduce((sum,item)=>sum+item.price,0):week.actualTotal??0);
const confirmedPurchases=[...expenses,...weekFourPurchases.map(item=>({source:item.source,name:item.name,category:item.category,amount:item.price}))];
const confirmedTotal=confirmedPurchases.reduce((sum,item)=>sum+item.amount,0);
if(Math.abs(historicalTotals.reduce((sum,n)=>sum+n,0)-confirmedTotal)>0.01) throw new Error("Исторические расходы не сходятся");
const pageTabs=[{id:"archive",label:"Меню и архив"},{id:"purchases",label:"Закупки"},{id:"stock",label:"Остатки"},{id:"expenses",label:"Расходы"}] as const;
type PageId=(typeof pageTabs)[number]["id"];
type RecipeOutcome=MealOutcome|"planned";
const recipeOutcomeLabels: Record<RecipeOutcome,string>={...mealOutcomeLabels,planned:"План"};
function MealHistoryBadges({ outcome, preference }: { outcome: RecipeOutcome; preference: MealPreference }) {
  return <span className="meal-history-badges">
    <span className={`meal-outcome outcome-${outcome}`}>{recipeOutcomeLabels[outcome]}</span>
    {preference && <span className={`meal-outcome preference-${preference}`}>{mealPreferenceLabels[preference]}</span>}
  </span>;
}

function WeekHistoryAudit({ week }: { week: number }) {
  if (week < 1 || week > 3) return null;
  const historyWeek = week as MealHistoryWeek;
  const summary = weekMealHistorySummaries[historyWeek];
  const previousMenuEntries = getWeekMealHistory(historyWeek).filter((entry) => entry.origin === "history_only");

  return <section className="week-history-audit" aria-label={`Факт приготовления недели ${week}`}>
    <div className="week-history-head">
      <div><span className="eyebrow">Проверка по сообщениям</span><h3>Что готовили и что убрали</h3></div>
      <p>Расходы и наличие рецепта не доказывают готовку. Здесь факт, предварительный план и отсутствие отчёта разделены.</p>
    </div>
    <div className="week-history-stats">
      <article><span>Готовили</span><strong>{summary.outcomes.cooked}</strong><small>Подтверждено сообщением</small></article>
      <article><span>Не ели</span><strong>{summary.outcomes.not_eaten}</strong><small>Подтверждённый пропуск</small></article>
      <article><span>Планировали пропустить</span><strong>{summary.outcomes.planned_to_skip}</strong><small>Итог ещё не подтверждён</small></article>
      <article><span>Без подтверждения</span><strong>{summary.outcomes.unconfirmed}</strong><small>Не считаем приготовленным</small></article>
    </div>
    <ul className="week-history-notes">{weekMealHistoryNotes[historyWeek].map((note) => <li key={note}>{note}</li>)}</ul>
    {previousMenuEntries.length > 0 && <div className="previous-menu-entries">
      <div className="subhead"><h3>Строки, убранные из итогового меню</h3><span>Сохраняем причину и уровень уверенности</span></div>
      {previousMenuEntries.map((entry) => <article key={entry.id}>
        <div><span>{entry.day} · {entry.mealType}</span><h4>{entry.title}</h4><p>{entry.note}</p></div>
        <MealHistoryBadges outcome={entry.outcome} preference={entry.preference} />
      </article>)}
    </div>}
  </section>;
}

type LiveClock = {
  now: Date;
  source: ClockSource;
};

function useMoscowClock() {
  const [clock, setClock] = useState<LiveClock | null>(null);

  useEffect(() => {
    let stopped = false;
    let source: ClockSource = "device";
    let onlineOffsetMs = 0;
    let midnightTimer = 0;

    const currentInstant = () => new Date(Date.now() + onlineOffsetMs);
    const update = () => {
      if (!stopped) setClock({ now: currentInstant(), source });
    };
    const scheduleMidnightRefresh = () => {
      window.clearTimeout(midnightTimer);
      midnightTimer = window.setTimeout(() => {
        update();
        scheduleMidnightRefresh();
      }, millisecondsUntilNextMoscowMidnight(currentInstant()) + 150);
    };
    const syncOnline = async () => {
      try {
        const onlineNow = await fetchNetworkNow(window.fetch.bind(window), window.location.href);
        if (stopped) return;
        onlineOffsetMs = onlineNow.getTime() - Date.now();
        source = "network";
      } catch {
        if (source !== "network") {
          onlineOffsetMs = 0;
          source = "device";
        }
      }
      update();
      scheduleMidnightRefresh();
    };
    const refreshAfterReturn = () => {
      if (document.visibilityState === "visible") {
        update();
        void syncOnline();
      }
    };

    update();
    scheduleMidnightRefresh();
    void syncOnline();
    const tickTimer = window.setInterval(update, 30_000);
    const syncTimer = window.setInterval(() => void syncOnline(), 10 * 60_000);
    window.addEventListener("focus", refreshAfterReturn);
    window.addEventListener("pageshow", refreshAfterReturn);
    document.addEventListener("visibilitychange", refreshAfterReturn);

    return () => {
      stopped = true;
      window.clearInterval(tickTimer);
      window.clearInterval(syncTimer);
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refreshAfterReturn);
      window.removeEventListener("pageshow", refreshAfterReturn);
      document.removeEventListener("visibilitychange", refreshAfterReturn);
    };
  }, []);

  return clock;
}


function PlanFrame({view,november=false}:{view:"shopping"|"stock"|"expenses";november?:boolean}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [height,setHeight]=useState(850);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.type!=="nutrition-frame-size")return;
   const next=Number(event.data.height);
   if(Number.isFinite(next)&&next>=100&&next<=25000)setHeight(next);
  };
  window.addEventListener("message",receive);
  return ()=>window.removeEventListener("message",receive);
 },[]);
 return <iframe ref={frame} className="workspace-frame" style={{height}} src={november?'./november-plan.html?embed=1':`./nutrition-plan.html?embed=1&view=${view}`} title={november?"Закупки ноября · недели 13–16":view==="shopping"?"Закупки недель 5–12":view==="stock"?"Остатки продуктов":"Записать расходы"} />;
}
export default function Home(){
 const [activePage,setActivePage]=useState<PageId>("archive");
 const [weekNumber,setWeekNumber]=useState(13);
 const [shoppingCycle,setShoppingCycle]=useState<"october"|"november">("november");
 const [selected,setSelected]=useState<Meal|null>(null);
 const [recipeTrigger,setRecipeTrigger]=useState<HTMLButtonElement|null>(null);
 const closeButton=useRef<HTMLButtonElement>(null);
 const liveClock=useMoscowClock();
 const calendar=liveClock?getPlanCalendar(liveClock.now):null;
 const current=menuWeeks.find(week=>week.number===weekNumber)??menuWeeks[4];
 const range=PLAN_WEEK_RANGES.find(item=>item.number===weekNumber)!;
 const temporal=calendar?.weeks.find(item=>item.number===weekNumber)?.temporalStatus;
 const isHistorical=weekNumber<=4;
 useEffect(()=>{
  if(!selected)return;
  document.body.classList.add("modal-open");
  closeButton.current?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==="Escape")setSelected(null);
   if(event.key==="Tab"){event.preventDefault();closeButton.current?.focus();}
  };
  document.addEventListener("keydown",keyboard);
  return ()=>{document.body.classList.remove("modal-open");document.removeEventListener("keydown",keyboard);recipeTrigger?.focus();};
 },[selected,recipeTrigger]);
 function showPage(page:PageId){setActivePage(page);setSelected(null);window.scrollTo({top:0,behavior:"smooth"});}
 function weekTab(week:Week){
  const weekRange=PLAN_WEEK_RANGES.find(r=>r.number===week.number)!;
  const state=calendar?.weeks.find(r=>r.number===week.number)?.temporalStatus;
  return <button id={`archive-week-tab-${week.number}`} type="button" aria-pressed={weekNumber===week.number} className={`${weekNumber===week.number?"active":""} ${week.number<=4?"archived-tab":""}`} key={week.number} onClick={()=>setWeekNumber(week.number)}><span>Неделя {week.number}<small>{formatPlanWeekRange(weekRange).replace(" 2026","")}</small><small>{state==="current"?"Сейчас по Москве":week.number<=4?"Архив":state==="past"?"Прошла · факт не подтверждён":"План"}</small></span></button>;
 }
 return <>
 <header className="topbar"><div className="shell topbar-inner"><button className="brand" onClick={()=>showPage("archive")}><span className="brand-mark">ПР</span><span>Петербургский рацион</span></button><span className="location">На двоих · 25 000 ₽ / 4 недели</span></div><div className="page-tabs-shell"><div className="shell page-tabs" role="tablist" aria-label="Разделы сайта">{pageTabs.map(tab=><button key={tab.id} id={`page-tab-${tab.id}`} role="tab" aria-selected={activePage===tab.id} aria-controls={`page-${tab.id}`} className={activePage===tab.id?"active":""} onClick={()=>showPage(tab.id)}>{tab.label}</button>)}</div></div></header>
 <main className="compact-workspace">
 {activePage==="archive"&&<section id="page-archive" className="section shell page-panel" role="tabpanel" aria-labelledby="page-tab-archive">
 <div className="section-heading"><div><span className="eyebrow">Меню и архив · недели 1–16</span><h1>Что готовим</h1></div><p>{calendar?`${calendar.russianDate} · ${calendar.moscowTime} МСК`:"Сверяем дату по Москве…"}{calendar?.activePlanWeek&&<><br/><button className="text-button" onClick={()=>setWeekNumber(calendar.activePlanWeek!)}>Открыть текущую неделю {calendar.activePlanWeek}</button></>}</p></div>
 <div className="tabs all-weeks" aria-label="Недели 9–12">{menuWeeks.slice(8,12).map(weekTab)}</div>
 <details className="archive-weeks" open={weekNumber>=13}><summary>Ноябрь · недели 13–16 · 2–29 ноября</summary><div className="tabs all-weeks" aria-label="Недели 13–16">{menuWeeks.slice(12).map(weekTab)}</div><p className="muted">План четырёх недель — {money(novemberTotal)} с резервом 5% и подтверждёнными остатками от 1 ноября. Цены — ориентиры из покупок; соль оценена отдельно. Недели 14–16 предварительные.</p></details>
 <details className="archive-weeks" open={weekNumber<=8}><summary>Архив недель 1–8</summary><div className="tabs all-weeks" aria-label="Архив недель 1–8">{menuWeeks.slice(0,8).map(weekTab)}</div></details>
 <div className="week-head"><div><span>{String(weekNumber).padStart(2,"0")}</span><div><h2>{current.title}</h2><p>{formatPlanWeekRange(range)} · {isHistorical?"архив":temporal==="past"?"прошедшее меню, готовка не подтверждена":"запланировано"}</p></div></div><button className="secondary" onClick={()=>{setShoppingCycle(weekNumber>=13?"november":"october");showPage(isHistorical?"expenses":"purchases");}}>{isHistorical?"Расходы":"Что купить"}</button></div>
 {weekNumber>=6&&<p className="muted">{weekNumber>=12?'Все ужины с понедельника по пятницу и в воскресенье — на 3 порции. Субботний ужин и оба завтрака выходных — на 2. Третья пятничная порция уже включена в покупки.':'Выходные: плотный завтрак и ужин, без обеда. Воскресный ужин — на 3 порции, с обедом Ане на понедельник.'}</p>}
 <div className="meal-list">{current.meals.map((meal,index)=>{
 const history=weekNumber<=3?getMealHistoryByMenuKey(`${weekNumber}:${meal.title}`):weekNumber===5?futureWeekFiveOutcomes[index]:undefined;
 return <button className="meal meal-with-history" type="button" aria-haspopup="dialog" key={index} onClick={event=>{setRecipeTrigger(event.currentTarget);setSelected(meal);}}><span className="day">{meal.day}<small>{meal.type}</small></span><span className="dish">{meal.title}<small>{meal.batch}</small>{history&&<small className="meal-history-note">{history.note}</small>}</span><span className="meal-action"><MealHistoryBadges outcome={history?.outcome??(weekNumber<=5?"unconfirmed":"planned")} preference={history?.preference??null}/><span className="open">Рецепт</span></span></button>;
 })}</div>
 {!isHistorical&&<details className="expenses week-extras"><summary>Дополнения и подготовка недели</summary><div className="details-content"><ul>{current.prep.map(s=><li key={s}>{s}</li>)}</ul>{(weekNumber>=13?novemberMenuExtras:futureExtras[weekNumber-5]).map(extra=><article key={extra.title}><h3>{extra.title}</h3><p>{extra.how}</p><small>{extra.quantity}</small></article>)}</div></details>}
 {isHistorical&&<details className="expenses"><summary>История недели и подтверждения</summary><WeekHistoryAudit week={weekNumber}/><div className="details-content"><p>{current.archiveNote??"Сохраняем прежнее меню. Наличие рецепта и покупки не подтверждает приготовление."}</p><ul>{current.prep.map(s=><li key={s}>{s}</li>)}</ul></div></details>}
 </section>}
 {activePage==="purchases"&&<section id="page-purchases" className="page-panel" role="tabpanel" aria-labelledby="page-tab-purchases"><div className="shell"><div className="tabs all-weeks" aria-label="Период закупок"><button type="button" aria-pressed={shoppingCycle==="october"} className={shoppingCycle==="october"?"active":""} onClick={()=>setShoppingCycle("october")}>Недели 9–12 и архив</button><button type="button" aria-pressed={shoppingCycle==="november"} className={shoppingCycle==="november"?"active":""} onClick={()=>setShoppingCycle("november")}>Ноябрь · недели 13–16</button></div></div><PlanFrame key={shoppingCycle} view="shopping" november={shoppingCycle==="november"}/></section>}
 {activePage==="stock"&&<section id="page-stock" className="page-panel" role="tabpanel" aria-labelledby="page-tab-stock"><div className="shell"><h1>Остатки на 2 ноября</h1><p>Сообщены 1 ноября. Пакетики круп — по 60 г; две котлеты вместе 120 г. Столбец справа — прогноз остатка из этого запаса после недели 13, без новых покупок.</p>{confirmedStock.map(r=><div className="expense-row" key={r.name}><div>{r.name}<small>Сейчас: {r.quantity}</small></div><strong>После: {r.remaining}</strong></div>)}<p>Горох сохраняем в шкафу. Творог и молоко для поздних дней при необходимости заморозить пригодными сейчас; размораживать в холодильнике. Соль 1 кг покупаем.</p></div></section>}
 {activePage==="expenses"&&<section id="page-expenses" className="page-panel" role="tabpanel" aria-labelledby="page-tab-expenses"><div className="shell"><h2>Неделя 12 ·26 октября–1 ноября</h2><p>Чек 3962,51 ₽: еда 3683,53 ₽ и бытовые товары 278,98 ₽. Докупки 1400 ₽. Итого еда 5083,53 ₽; все сообщённые траты 5362,51 ₽.</p><details><summary>Покупки еды и докупки</summary>{week12ActualItems.map((r,i)=><div className="expense-row" key={i}><span>{r.name}<small>{r.date}</small></span><strong>{money(r.amount)}</strong></div>)}</details><details><summary>Бытовые товары отдельно ·278,98 ₽</summary>{week12Household.map((r,i)=><div className="expense-row" key={i}><span>{r.name}</span><strong>{money(r.amount)}</strong></div>)}</details></div>
  <div className="shell section"><div className="section-heading"><div><span className="eyebrow">Расходы</span><h1>План отдельно от покупок</h1></div></div>
   <div className="expense-period-cards"><article className="panel"><h2>Недели 9–12 · сообщённые покупки</h2><strong className="finance-total">{money(futurePlanTotal)}</strong><p>Лимит {money(budget)} на четыре недели. За недели 9–12 сообщено {money(futureCurrentCycleActual)} на еду. Неделя 12: 3 683,53 ₽ по чеку и 1 400 ₽ докупок, всего 5 083,53 ₽. Бытовые товары 278,98 ₽ показаны отдельно. Полнота расходов за цикл не подтверждена; стоимость доставки недели 11 не сообщена.</p><div className="compact-totals">{futureWeekTotals.slice(4).map((n,i)=><span key={i}>Неделя {i+9} · сообщено<strong>{money(n)}</strong></span>)}</div></article>
   <article className="panel"><h2>Недели 5–8 · сообщённые покупки</h2><strong className="finance-total">{money(futureConfirmedTotal)}</strong><p>Неделя 8: чек 27.09 — 5 103,62 ₽; дополнительные покупки — 970 ₽, всего 6 073,62 ₽. До неё было сообщено 10 653,02 ₽. Полнота расходов за цикл не подтверждена; прежние прогнозы не превращены в факт.</p><details className="expenses"><summary>Подробности в журнале расходов</summary><p>Покупки и недели разнесены по чекам и сообщениям. Воду 120 ₽ учли только в прошлом факте, в будущих корзинах её нет.</p></details></article>
   <article className="panel"><h2>Недели 1–4 · факт</h2><strong className="finance-total">{money(confirmedTotal)}</strong><p>10 августа — 6 сентября. Только учтённые покупки; новые недели сюда не добавляются.</p><div className="compact-totals">{historicalTotals.map((n,i)=><span key={i}>Неделя {i+1}<strong>{money(n)}</strong></span>)}</div><details className="expenses"><summary>Показать прошлые покупки</summary><div className="receipt-history">{confirmedPurchases.map((item,i)=><div key={i}><span>{item.name}<small>{item.source}</small></span><strong>{money(item.amount)}</strong></div>)}</div></details></article></div>
  </div><PlanFrame view="expenses"/>
 </section>}
 </main>
 <footer><div className="shell">Петербургский рацион · Санкт-Петербург · порции указаны в рецептах · калории и будущие цены приблизительные</div></footer>
 {selected&&<div className="backdrop"><button className="backdrop-dismiss" tabIndex={-1} aria-label="Закрыть рецепт" onClick={()=>setSelected(null)}/><section className="recipe" role="dialog" aria-modal="true" aria-labelledby="recipe-title"><div className="recipe-head"><div><span>Неделя {weekNumber} · {selected.day} · {selected.type}</span><h2 id="recipe-title">{selected.title}</h2></div><button ref={closeButton} type="button" aria-label="Закрыть рецепт" onClick={()=>setSelected(null)}>×</button></div><div className="recipe-meta"><span>{selected.recipe.time}</span><span>{selected.batch}</span></div><div className="recipe-body"><div><h3>Ингредиенты на {selected.recipe.portions}</h3><ul>{selected.recipe.ingredients.map((s,i)=><li key={i}>{s}</li>)}</ul></div><div><h3>Пошаговое приготовление</h3><ol>{selected.recipe.steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div></div>{selected.recipe.note&&<p className="recipe-note">{selected.recipe.note}</p>}</section></div>}
 </>;
}
