"use client";

import { useEffect, useMemo, useState } from "react";
import { recipeDetails } from "./recipe-details";
import { baseWeeks, expenses, foodPreferences, nextMonthReviewProtocol, priceSignals, stock, unitPrices, valueLeaders, weekFourPurchases, type Expense, type Meal, type ShopItem, type Week } from "./plan-data";
import { PriceMemory } from "./price-memory";
import { nextMonthPurchaseDecisionPreview } from "./purchase-decisions";
import { nextMonthFormulaPreview } from "./shopping-planner";

const rubles = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rounded = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const exact = (value: number) => `${rubles.format(value)} ₽`;
const money = (value: number) => `${rounded.format(Math.round(value))} ₽`;
const amount = (value: number, unit: "g" | "ml" | "pcs") => `${rounded.format(value)} ${unit === "g" ? "г" : unit === "ml" ? "мл" : "шт."}`;
const total = (items: ShopItem[]) => items.reduce((sum, item) => sum + item.price, 0);

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
const confirmedPreviousTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
const currentWeekPaid = total(weekFourPurchases);
const confirmedPurchases: Expense[] = [
  ...expenses,
  ...weekFourPurchases.map((item) => ({ source: item.source, name: item.name, category: item.category, amount: item.price })),
];
const confirmedTotal = confirmedPreviousTotal + currentWeekPaid;
const archivedWeeks = weeks.filter((week) => week.archived);
const futureWeeks = weeks.filter((week) => !week.archived);
const archivedActualTotal = archivedWeeks.reduce((sum, week) => sum + (week.actualTotal ?? 0), 0);
if (Math.abs(archivedActualTotal - confirmedPreviousTotal) > 0.01) {
  throw new Error(`Фактические итоги закрытых недель (${archivedActualTotal}) не совпадают с их покупками (${confirmedPreviousTotal}).`);
}
const futureTotal = futureWeeks.reduce((sum, week) => sum + total(week.shopping), 0);
const plannedMonth = confirmedTotal + futureTotal;
const observedWeeklyAverage = confirmedTotal / weeks.length;
const runRateMonth = observedWeeklyAverage * 4;
const forecastLow = Math.ceil(plannedMonth / 100) * 100;
const forecastHigh = Math.ceil((plannedMonth + 1_000) / 100) * 100;
const weekOneTotal = weeks.find((week) => week.number === 1)?.actualTotal ?? 0;
const weekTwoTotal = weeks.find((week) => week.number === 2)?.actualTotal ?? 0;
const weekThreeTotal = weeks.find((week) => week.number === 3)?.actualTotal ?? 0;
const currentWeek = weeks.find((week) => week.number === 4) ?? weeks[weeks.length - 1];

const pageTabs = [
  { id: "overview", label: "Обзор" },
  { id: "current", label: "Текущая неделя" },
  { id: "archive", label: "Меню и архив" },
  { id: "purchases", label: "Закупки и цены" },
  { id: "recipes", label: "База рецептов" },
  { id: "rules", label: "Правила" },
] as const;
type PageId = (typeof pageTabs)[number]["id"];
type RecipeStatus = "favorite" | "liked" | "cooked" | "blocked" | "unverified" | "planned";
type RecipeFilter = "all" | "liked" | "cooked" | "blocked" | "unverified" | "planned";

const recipeLibrary = weeks.flatMap((week) => week.meals.map((meal, index) => {
  const reference = `${week.number}:${meal.title}`;
  const confirmedWeekOneMeals = new Set([
    "1:Филе с картофелем, огурцами и томатами",
    "1:Пицца с курицей, грибами и томатами",
    "1:Творожно-овсяные панкейки",
  ]);
  const cooked = week.number === 3 || confirmedWeekOneMeals.has(reference);
  const status: RecipeStatus = reference === "1:Пицца с курицей, грибами и томатами" ? "favorite"
    : reference === "3:Сырники с ягодами и йогуртом" ? "liked"
      : reference === "3:Пангасиус с картофелем, фасолью и лимонным соусом" ? "blocked"
        : cooked ? "cooked"
          : week.number === 4 ? "planned" : "unverified";
  return { id: `${week.number}:${index}:${meal.title}`, week, meal, status, cooked };
}));

const matchesRecipeFilter = (item: (typeof recipeLibrary)[number], filter: RecipeFilter) => {
  if (filter === "all") return true;
  if (filter === "liked") return item.status === "liked" || item.status === "favorite";
  if (filter === "cooked") return item.cooked;
  return item.status === filter;
};

const recipeStatusLabels: Record<RecipeStatus, string> = {
  favorite: "любимое",
  liked: "понравилось",
  cooked: "готовили",
  blocked: "чёрный список",
  unverified: "оценка не указана",
  planned: "в плане",
};

const recipeFilters: { id: RecipeFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "liked", label: "Понравились" },
  { id: "cooked", label: "Готовили" },
  { id: "unverified", label: "Без оценки" },
  { id: "planned", label: "В плане" },
  { id: "blocked", label: "Чёрный список" },
];

export default function Home() {
  const [activePage, setActivePage] = useState<PageId>("overview");
  const [weekNumber, setWeekNumber] = useState(1);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>("all");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [recipeCopyLabel, setRecipeCopyLabel] = useState("Скопировать выбранное");
  const current = weeks.find((week) => week.number === weekNumber) ?? weeks[0];

  const categories = useMemo(() => {
    const result = new Map<string, number>();
    confirmedPurchases.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + item.amount));
    return [...result.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const maxCategory = Math.max(...categories.map(([, value]) => value));
  const visibleRecipes = recipeLibrary.filter((item) => matchesRecipeFilter(item, recipeFilter));
  const chosenRecipes = recipeLibrary.filter((item) => selectedRecipeIds.includes(item.id));

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", close);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("modal-open");
    };
  }, [selected]);

  function showPage(page: PageId) {
    setActivePage(page);
    setSelected(null);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function toggleRecipe(id: string) {
    setSelectedRecipeIds((currentIds) => currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id]);
  }

  async function copySelectedRecipes() {
    if (chosenRecipes.length === 0) return;
    const content = chosenRecipes.map((item) => `Неделя ${item.week.number} — ${item.meal.title}`).join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setRecipeCopyLabel("Выбор скопирован");
    } catch {
      setRecipeCopyLabel("Скопируйте вручную");
    }
    window.setTimeout(() => setRecipeCopyLabel("Скопировать выбранное"), 1800);
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <button className="brand" type="button" onClick={() => showPage("overview")} aria-label="Открыть обзор"><span className="brand-mark">ПР</span><span>Петербургский рацион</span></button>
          <span className="location">Санкт-Петербург</span>
        </div>
        <div className="page-tabs-shell">
          <div className="shell page-tabs" aria-label="Разделы сайта" role="tablist">
            {pageTabs.map((tab) => <button id={`page-tab-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={activePage === tab.id} aria-controls={`page-${tab.id}`} className={activePage === tab.id ? "active" : ""} onClick={() => showPage(tab.id)}>{tab.label}</button>)}
          </div>
        </div>
      </header>

      <main id="top">
        {activePage === "overview" && <div className="page-panel" id="page-overview" role="tabpanel" aria-labelledby="page-tab-overview">
          <section className="hero shell">
            <div className="hero-copy"><span className="eyebrow">Обновлено 30 августа · неделя 4 уже закуплена</span><h1>Питание на месяц для двоих</h1><p>Здесь — только действующая картина месяца: подтверждённые траты, факт прошедших недель и прогноз. Меню, закупки, рецепты и правила разнесены по отдельным вкладкам сверху.</p></div>
            <aside className="budget-card"><div className="budget-head"><span>Текущий бюджет</span><strong>{money(budget)}</strong></div><div className="meter" aria-label={`Использовано ${Math.min(100, plannedMonth / budget * 100).toFixed(0)} процентов бюджета`}><span style={{ width: `${Math.min(100, plannedMonth / budget * 100)}%` }} /></div><div className="budget-numbers"><div><span>Продукты · подтверждено</span><strong>{exact(confirmedTotal)}</strong></div><div><span>Коридор месяца</span><strong>{money(forecastLow)}–{money(forecastHigh)}</strong></div></div><p>За неделю 4 уже оплачено {exact(currentWeekPaid)}. Неподтверждённые покупки и цены в факт не добавляются.</p></aside>
          </section>
          <section className="section shell overview-fact" id="fact"><div className="section-heading"><div><span className="eyebrow">Прошедшие недели</span><h2>Факт и текущий месяц</h2></div><p>Закрытые недели 1–3 сохранены в архиве. Неделя 4 показана отдельно как уже оплаченная и ещё продолжающаяся.</p></div><div className="stats"><article className="stat stat-primary"><span>Прошедшие недели · факт</span><strong>{exact(confirmedPreviousTotal)}</strong><small>Н1 — {exact(weekOneTotal)}, Н2 — {exact(weekTwoTotal)}, Н3 — {exact(weekThreeTotal)}.</small></article><article className="stat"><span>Неделя 4 · оплачено</span><strong>{exact(currentWeekPaid)}</strong><small>Чек {exact(3895.51)} + фрукты {exact(130)} + молоко {exact(140)}.</small></article><article className="stat"><span>Продукты · подтверждено</span><strong>{exact(confirmedTotal)}</strong><small>Только покупки с известной ценой, без предположений.</small></article><article className="stat"><span>Резерв бюджета</span><strong>{exact(budget - confirmedTotal)}</strong><small>Оплачено всего {exact(confirmedTotal + mascarponeOutsidePlan)} с маскарпоне {exact(mascarponeOutsidePlan)} вне рациона.</small></article></div></section>
          <section className="section forecast"><div className="shell forecast-card"><div><span className="eyebrow">Действующий прогноз месяца</span><h2>{money(forecastLow)}–{money(forecastHigh)}</h2><p>Подтверждённая продуктовая сумма уже составляет {exact(plannedMonth)}. Верхняя граница оставляет запас на мелкие докупки до конца недели.</p></div><div className="forecast-weeks">{archivedWeeks.map((week) => <div key={week.number}><span>Неделя {week.number} · факт</span><strong>{exact(week.actualTotal ?? 0)}</strong></div>)}<div><span>Неделя 4 · оплачено</span><strong>{exact(currentWeekPaid)}</strong></div></div><p className="method"><strong>Факт продуктов:</strong> {exact(confirmedTotal)}. <strong>Коридор:</strong> до {money(forecastHigh)} при дополнительных покупках не больше {money(1_000)}. <strong>Ожидаемый резерв:</strong> не менее {money(Math.max(0, budget - forecastHigh))}.</p></div></section>
        </div>}

        {activePage === "current" && <div className="page-panel" id="page-current" role="tabpanel" aria-labelledby="page-tab-current">
          <section className="section shell page-intro-section"><div className="section-heading"><div><span className="eyebrow">Неделя {currentWeek.number} · куплено</span><h2>Текущая неделя</h2></div><p>{currentWeek.focus}</p></div><div className="week-head current-week-head"><div><span>0{currentWeek.number}</span><div><h3>{currentWeek.title}</h3><p>Покупки уже внесены на {exact(total(currentWeek.purchases ?? []))}; полный чек находится во вкладке «Закупки и цены».</p></div></div></div><div className="variety" aria-label="Разнообразие текущей недели"><strong>В ротации</strong>{currentWeek.variety.map((item) => <span key={item}>{item}</span>)}</div><div className="week-grid"><div><div className="subhead"><h3>Меню недели</h3><span>Нажмите на блюдо, чтобы открыть подробный рецепт</span></div><div className="meal-list">{currentWeek.meals.map((item, index) => <button className="meal" type="button" key={`${item.day}-${index}`} onClick={() => setSelected(item)}><span className="day">{item.day}<small>{item.type}</small></span><span className="dish">{item.title}<small>{item.batch}</small></span><span className="open">Рецепт</span></button>)}</div></div><aside className="prep"><span>Подготовка недели</span><ol>{currentWeek.prep.map((item) => <li key={item}>{item}</li>)}</ol></aside></div></section>
          <section className="section tint" id="stock"><div className="shell"><div className="section-heading"><div><span className="eyebrow">Домашний остаток</span><h2>Что используем в первую очередь</h2></div><p>Белая рыба исключена и не вычитается из потребности. Сначала идут свежие овощи и открытые продукты, сухие крупы остаются резервом.</p></div><div className="stock-grid">{stock.map((item) => <div className="stock-item" key={item.name}><span>{item.name}</span><strong>{item.quantity}</strong><small className={`stock-priority ${item.priority}`}>{item.priority === "сначала" ? "используем раньше" : "долгий запас"}</small></div>)}</div><p className="footnote">Остатки зафиксированы со слов пользователя 29 августа. Оба фарша находятся в морозилке; размораживайте их в холодильнике. Неупомянутые продукты не считаются запасом.</p></div></section>
        </div>}

        {activePage === "archive" && <section className="section shell page-panel page-intro-section" id="page-archive" role="tabpanel" aria-labelledby="page-tab-archive"><div className="section-heading"><div><span className="eyebrow">Меню и архив</span><h2>Все четыре недели</h2></div><p>Недели 1–3 сохраняют историю приготовленных блюд и рецепты. Неделя 4 доступна как текущий план, без повторной таблицы покупок.</p></div><div className="tabs" role="tablist" aria-label="Недели меню">{weeks.map((week) => <button type="button" role="tab" aria-selected={week.number === current.number} className={`${week.number === current.number ? "active" : ""} ${week.archived ? "archived-tab" : ""}`} key={week.number} onClick={() => setWeekNumber(week.number)}><span>{week.archived ? `Неделя ${week.number} · архив` : week.status === "purchased_locked" ? `Неделя ${week.number} · куплено` : `Неделя ${week.number}`}</span><strong>{week.archived ? exact(week.actualTotal ?? 0) : exact(week.status === "purchased_locked" ? total(week.purchases ?? []) : total(week.shopping))}</strong></button>)}</div><div className="week-head"><div><span>0{current.number}</span><div><h3>{current.title}</h3><p>{current.focus}</p></div></div></div><div className="variety" aria-label={`Разнообразие недели ${current.number}`}><strong>В ротации</strong>{current.variety.map((item) => <span key={item}>{item}</span>)}</div><div className="week-grid"><div><div className="subhead"><h3>Меню</h3><span>Точные количества и пошаговое приготовление внутри каждого блюда</span></div><div className="meal-list">{current.meals.map((item, index) => <button className="meal" type="button" key={`${item.day}-${index}`} onClick={() => setSelected(item)}><span className="day">{item.day}<small>{item.type}</small></span><span className="dish">{item.title}<small>{item.batch}</small></span><span className="open">Рецепт</span></button>)}</div></div><aside className="prep"><span>{current.archived ? "Статус архива" : "Подготовка недели"}</span><ol>{current.prep.map((item) => <li key={item}>{item}</li>)}</ol></aside></div>{current.archived && <article className="archive-panel"><span>Архив сохранён</span><p>{current.archiveNote}</p></article>}</section>}

        {activePage === "purchases" && <div className="page-panel" id="page-purchases" role="tabpanel" aria-labelledby="page-tab-purchases">
          <section className="section shell page-intro-section"><div className="section-heading"><div><span className="eyebrow">Закупки и цены</span><h2>Факт, причины и расчёт</h2></div><p>Чеки присылаются в GPT. На сайт попадают только разобранные товарные строки, подтверждённые суммы и понятные причины изменения закупки — без хранения самих файлов чеков.</p></div><div className="purchase-workflow" aria-label="Статусы закупки"><article><span className="purchase-state paid">Куплено</span><h3>Есть товар и цена</h3><p>Строка входит в фактические траты и историю цен.</p></article><article><span className="purchase-state no-price">Нет цены</span><h3>Факт без суммы</h3><p>Позиция сохраняется, но не увеличивает итог до получения цены.</p></article><article><span className="purchase-state skipped">Не куплено</span><h3>Нет подтверждения</h3><p>Плановая позиция не считается фактом, пока покупки нет в чеке или сообщении.</p></article><article><span className="purchase-state removed">Удалено из закупки</span><h3>Покрыто остатком</h3><p>Огурцы и помидоры не добавлены повторно: дома уже было достаточно.</p></article></div><article className="purchase-journal"><div className="panel-head"><h3>Пример журнала следующего месяца</h3><span>проверка механики, не текущая закупка</span></div><p className="planner-note">Огурцы, помидоры, яйца и йогурт ниже — демонстрационные строки формулы. Реальный журнал появится после нового меню, остатков и сообщения о покупках.</p><div className="purchase-journal-list">{nextMonthPurchaseDecisionPreview.map((item) => <div className="purchase-journal-row" key={item.id}><span className={`decision-status ${item.status}`}>{item.statusLabel}</span><strong>{item.productName}</strong><p>{item.reason}</p><b>{item.expectedCost === null ? "нет данных" : exact(item.expectedCost)}</b></div>)}</div></article><div className="shopping purchased"><div className="shopping-head"><div><span className="lock-label">Закуплено · зафиксировано</span><h3>Фактические покупки недели 4</h3><p>Это уже оплаченные позиции, а не повторный список «что купить».</p></div><strong>{exact(total(currentWeek.purchases ?? []))}</strong></div><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Раздел</th><th>Куплено</th><th>Количество</th><th>Факт</th></tr></thead><tbody>{(currentWeek.purchases ?? []).map((item, index) => <tr key={`${item.source}-${item.name}-${index}`}><td data-label="Источник">{item.source}</td><td data-label="Раздел">{item.category}</td><td data-label="Куплено">{item.name}{item.role === "extra" && <small className="extra-tag">вне основных рецептов</small>}{item.role === "snack" && <small className="extra-tag snack-tag">запланировано как перекус</small>}</td><td data-label="Количество">{item.quantity}</td><td data-label="Факт">{exact(item.price)}</td></tr>)}</tbody></table></div></div></section>
          <section className="section shell price-memory-section"><PriceMemory /></section>
          <section className="section tint"><div className="shell"><div className="section-heading"><div><span className="eyebrow">Расходы за месяц</span><h2>На что ушли деньги</h2></div><p>Категории рассчитаны по подтверждённым покупкам. Качество брендов по одному фискальному чеку не доказано.</p></div><div className="analysis-stats"><article><span>Средняя оплаченная неделя</span><strong>{exact(observedWeeklyAverage)}</strong><small>Четыре недели покупок, включая уже купленную четвёртую.</small></article><article><span>Темп четырёх недель</span><strong>{exact(runRateMonth)}</strong><small>Равен подтверждённому продуктовому итогу месяца.</small></article><article><span>Пригодный остаток</span><strong>{stock.length} позиций</strong><small>Белая рыба исключена и не уменьшает будущую закупку.</small></article></div><div className="fact-grid"><article className="panel"><div className="panel-head"><h3>Категории расходов</h3><span>подтверждённые суммы</span></div><div className="category-list">{categories.map(([name, value]) => <div className="category" key={name}><div><span>{name}</span><strong>{exact(value)}</strong></div><div className="track"><span style={{ width: `${value / maxCategory * 100}%` }} /></div></div>)}</div></article><div className="notes"><article className="note success"><span>Проверено</span><h3>Новый чек сходится</h3><p>22 товарные позиции чека 29.08 дают ровно {exact(3895.51)}. Фрукты и молоко добавлены отдельно без задвоения.</p></article><article className="note"><span>Без задвоения</span><h3>Тортильи остались в неделе 3</h3><p>{exact(130)} относятся к текущему дню и увеличили факт недели 3 до {exact(weekThreeTotal)}.</p></article><article className="note warning"><span>Оценка, не факт</span><h3>Белая рыба выведена из рациона</h3><p>Если 300 г действительно будут выброшены, потенциальное списание составит около {money(108)}. Пока оно не добавлено к потерям.</p></article></div></div><details className="expenses"><summary>Все подтверждённые покупки за четыре недели</summary><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Позиция</th><th>Категория</th><th>Сумма</th></tr></thead><tbody>{confirmedPurchases.map((item, index) => <tr key={`${item.source}-${item.name}-${index}`}><td data-label="Источник">{item.source}</td><td data-label="Позиция">{item.name}</td><td data-label="Категория">{item.category}</td><td data-label="Сумма">{exact(item.amount)}</td></tr>)}</tbody></table></div></details></div></section>
          <section className="section shell"><div className="section-heading"><div><span className="eyebrow">Формула закупки</span><h2>Потребность минус остатки</h2></div><p>Ингредиенты считаются в момент готовки. Доедание порции не списывает их второй раз; дефицит округляется до доступной фасовки.</p></div><article className="planner-card"><div className="planner-intro"><div><span className="eyebrow">Расчётная модель</span><h3>Нужное количество → чистая закупка</h3></div><p>Домашний остаток вычитается только если пригоден к дате блюда. Затем учитываются уже купленные партии, чтобы не повторять овощи и другие продукты.</p></div><div className="formula-chain"><span>Σ ингредиентов всех готовок</span><b>−</b><span>пригодные остатки дома</span><b>−</b><span>уже купленные партии</span><b>=</b><span>дефицит → фасовка</span></div><div className="planner-example"><strong>Проверка механики, не закупка сентября</strong><span>Если нужно 900 г огурцов, а дома пригодны 700 г, купить нужно 200 г. Если 700 г помидоров покрывают 500 г рецептов, строка покупки равна нулю.</span></div><div className="table-wrap"><table className="planner-table"><thead><tr><th>Продукт</th><th>Нужно</th><th>Дома</th><th>Уже куплено</th><th>Дефицит</th><th>Купить</th><th>Останется</th><th>Цена</th></tr></thead><tbody>{nextMonthFormulaPreview.map((row) => <tr key={row.productId}><td data-label="Продукт">{row.productName}{row.warning && <small className="planner-warning">{row.warning}</small>}</td><td data-label="Нужно">{amount(row.grossNeed, row.unit)}</td><td data-label="Дома">{amount(row.homeAvailable, row.unit)}</td><td data-label="Уже куплено">{amount(row.alreadyPurchasedAvailable, row.unit)}</td><td data-label="Дефицит">{amount(row.netDeficit, row.unit)}</td><td data-label="Купить">{amount(row.purchaseQuantity, row.unit)}{row.packageBreakdown.length > 0 && <small>{row.packageBreakdown.join(", ")}</small>}</td><td data-label="Останется">{amount(row.projectedRemainder, row.unit)}</td><td data-label="Цена">{exact(row.expectedCost)}</td></tr>)}</tbody></table></div><p className="planner-note">Следующий месячный план дополнительно учитывает дату блюда, срок годности и причину исключения строки. Продукт без цены остаётся помеченным «нет данных», а не получает выдуманную стоимость.</p></article><details className="expenses analysis-details"><summary>Выгода продуктов и ценовые сигналы</summary><div className="details-content"><div className="value-grid">{valueLeaders.map((item) => <article className="value-card" key={item.rank}><span className="value-rank">{item.rank}</span><div><span className="value-criterion">{item.criterion}</span><h3>{item.product}</h3><p className="value-evidence">{item.evidence}</p><p>{item.conclusion}</p></div></article>)}</div><div className="signal-grid">{priceSignals.map((item) => <article className="signal-card" key={item.label}><span>{item.label}</span><h3>{item.evidence}</h3><p>{item.conclusion}</p></article>)}</div><details className="expenses price-list"><summary>Нормализованные цены из чеков</summary><div className="table-wrap"><table><thead><tr><th>Продукт</th><th>Цена</th></tr></thead><tbody>{unitPrices.map(([name, value]) => <tr key={name}><td data-label="Продукт">{name}</td><td data-label="Цена">{value}</td></tr>)}</tbody></table></div></details><p className="method-note"><strong>Метод.</strong> Цена за белок и калории — ориентир на типичные пищевые значения, а не данные чеков. Покупки без разбивки по весу входят в общий факт, но не в нормализованные цены.</p></div></details></section>
        </div>}

        {activePage === "recipes" && <section className="section shell page-panel page-intro-section" id="page-recipes" role="tabpanel" aria-labelledby="page-tab-recipes"><div className="section-heading"><div><span className="eyebrow">База рецептов</span><h2>Приготовленное и запланированное</h2></div><p>Пицца отмечена как любимая, сырники — как понравившиеся. Факт приготовления и оценка вкуса разделены: приготовленное блюдо не считается понравившимся без вашего отзыва.</p></div><div className="recipe-library-toolbar"><div className="recipe-filters" role="group" aria-label="Фильтр рецептов">{recipeFilters.map((filter) => <button type="button" key={filter.id} className={recipeFilter === filter.id ? "active" : ""} aria-pressed={recipeFilter === filter.id} onClick={() => setRecipeFilter(filter.id)}>{filter.label}<small>{recipeLibrary.filter((item) => matchesRecipeFilter(item, filter.id)).length}</small></button>)}</div><div className="recipe-selection"><span>Выбрано: <strong>{chosenRecipes.length}</strong></span><button type="button" className="secondary" disabled={chosenRecipes.length === 0} onClick={copySelectedRecipes}>{recipeCopyLabel}</button></div></div><p className="local-note"><strong>Локальный выбор.</strong> Отметки ниже живут только до перезагрузки этой страницы и никуда не отправляются. Чтобы закрепить подборку или новую оценку в плане, пришлите её в GPT.</p><div className="recipe-library-grid">{visibleRecipes.map((item) => <article className={`recipe-library-card status-${item.status}`} key={item.id}><div className="recipe-card-top"><label className={item.status === "blocked" ? "selection-disabled" : undefined}><input type="checkbox" disabled={item.status === "blocked"} checked={selectedRecipeIds.includes(item.id)} onChange={() => toggleRecipe(item.id)} /><span>{item.status === "blocked" ? "Не выбирать" : "Выбрать"}</span></label><div className="recipe-card-statuses"><span className={`recipe-status ${item.status}`}>{recipeStatusLabels[item.status]}</span>{item.cooked && item.status !== "cooked" && <span className="recipe-status cooked">готовили</span>}</div></div><span className="recipe-week">Неделя {item.week.number} · {item.meal.day} · {item.meal.type}</span><h3>{item.meal.title}</h3><p>{item.meal.batch}</p><button type="button" className="recipe-open-button" onClick={() => setSelected(item.meal)}>Открыть рецепт</button></article>)}</div>{visibleRecipes.length === 0 && <div className="empty-state"><h3>В этой категории пока пусто</h3><p>Оценка появится только после вашего сообщения, поэтому сайт не делает выводы за вас.</p></div>}</section>}

        {activePage === "rules" && <section className="section shell page-panel page-intro-section" id="page-rules" role="tabpanel" aria-labelledby="page-tab-rules"><div className="section-heading"><div><span className="eyebrow">Правила планирования</span><h2>Вкусы и выводы месяца</h2></div><p>Эти ограничения применяются к будущим меню. Текущая уже купленная неделя меняется только точечно, чтобы не списывать продукты без причины.</p></div><div className="preference-grid">{foodPreferences.map((item) => <article className="preference-card" key={item.title}><span>{item.timing}</span><h3>{item.title}</h3><p>{item.rule}</p></article>)}</div><div className="review-head"><span className="eyebrow">После завершения четырёх недель</span><h3>Как факт месяца превратится в новый план</h3><p>Проверяем чеки, реальное приготовление, отмены, размер порций, доедание и причины списаний.</p></div><div className="review-grid">{nextMonthReviewProtocol.map((item, index) => <article key={item.label}><span>0{index + 1}</span><h4>{item.label}</h4><p>{item.check}</p><small>{item.result}</small></article>)}</div></section>}
      </main>
      <footer><div className="shell">Петербургский рацион · расчёт для двоих · август 2026</div></footer>

      {selected && <div className="backdrop"><button className="backdrop-dismiss" type="button" aria-label="Закрыть рецепт" onClick={() => setSelected(null)} /><section className="recipe" role="dialog" aria-modal="true" aria-labelledby="recipe-title"><div className="recipe-head"><div><span>{selected.day} · {selected.type}</span><h2 id="recipe-title">{selected.title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => setSelected(null)}>×</button></div><div className="recipe-meta"><span>{selected.recipe.time}</span><span>{selected.recipe.steps.length} шагов</span><span>{selected.batch}</span></div><div className="recipe-guide"><strong>Готовьте по порядку</strong><span>Все количества рассчитаны на {selected.recipe.portions}; нужные граммы повторяются прямо в шагах.</span></div><div className="recipe-body"><div><h3>Ингредиенты на {selected.recipe.portions}</h3><ul>{selected.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Пошаговое приготовление</h3><ol>{selected.recipe.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></div>{selected.recipe.note && <p className="recipe-note">{selected.recipe.note}</p>}</section></div>}
    </>
  );
}
