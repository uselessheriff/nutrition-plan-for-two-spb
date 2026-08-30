"use client";

import { useEffect, useMemo, useState } from "react";
import { recipeDetails } from "./recipe-details";
import { baseWeeks, expenses, foodPreferences, nextMonthReviewProtocol, priceSignals, stock, unitPrices, valueLeaders, weekFourPurchases, type Expense, type Meal, type ShopItem, type Week } from "./plan-data";
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
  throw new Error(`Фактические итоги трёх закрытых недель (${archivedActualTotal}) не совпадают с их покупками (${confirmedPreviousTotal}).`);
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

export default function Home() {
  const [weekNumber, setWeekNumber] = useState(4);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [copyLabel, setCopyLabel] = useState("Скопировать список");
  const current = weeks.find((week) => week.number === weekNumber) ?? weeks[0];
  const currentRemainingTotal = total(current.shopping);
  const currentPaidTotal = total(current.purchases ?? []);
  const currentTabTotal = current.status === "purchased_locked" ? currentPaidTotal : currentRemainingTotal;

  const categories = useMemo(() => {
    const result = new Map<string, number>();
    confirmedPurchases.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + item.amount));
    return [...result.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const maxCategory = Math.max(...categories.map(([, value]) => value));

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

  async function copyShopping() {
    const content = [
      `Неделя ${current.number}: ${current.title}`,
      "",
      ...current.shopping.map((item) => `${item.name} — ${item.quantity} — ${money(item.price)}`),
      "",
      `Итого: ${money(currentRemainingTotal)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopyLabel("Список скопирован");
    } catch {
      setCopyLabel("Скопируйте вручную");
    }
    window.setTimeout(() => setCopyLabel("Скопировать список"), 1800);
  }

  return (
    <>
      <header className="topbar"><div className="shell topbar-inner"><a className="brand" href="#top"><span className="brand-mark">ПР</span><span>Петербургский рацион</span></a><nav><a href="#fact">Факт</a><a href="#analysis">Анализ</a><a href="#preferences">Правила</a><a href="#stock">Остатки</a><a href="#weeks">Меню</a></nav><span className="location">Санкт-Петербург</span></div></header>
      <main id="top">
        <section className="hero shell">
          <div className="hero-copy"><span className="eyebrow">Обновлено 30 августа · неделя 4 уже закуплена</span><h1>Питание на месяц для двоих</h1><p>Недели 1–3 сохранены вместе с подробными рецептами. Покупки недели 4 внесены по чеку и сообщениям, белая рыба заменена курицей без докупки, а сама уже оплаченная неделя зафиксирована от случайного пересчёта.</p></div>
          <aside className="budget-card"><div className="budget-head"><span>Текущий бюджет</span><strong>{money(budget)}</strong></div><div className="meter"><span style={{ width: `${Math.min(100, plannedMonth / budget * 100)}%` }} /></div><div className="budget-numbers"><div><span>Продукты · подтверждено</span><strong>{exact(confirmedTotal)}</strong></div><div><span>Коридор месяца</span><strong>{money(forecastLow)}–{money(forecastHigh)}</strong></div></div><p>За неделю 4 уже оплачено {exact(currentWeekPaid)}. Повторной корзины на сайте нет; возможные мелкие докупки пока не выдумываются.</p></aside>
        </section>

        <section className="section shell" id="fact">
          <div className="section-heading"><div><span className="eyebrow">Четыре недели покупок</span><h2>Подтверждённые траты</h2></div><p>Внесены товарные строки чеков и сообщённые докупки. Новая «Лента» на {exact(3895.51)}, фрукты на {exact(130)} и молоко на {exact(140)} учтены как уже оплаченная неделя 4; тортильи на сегодня оставлены в неделе 3.</p></div>
          <div className="stats">
            <article className="stat stat-primary"><span>Продукты · подтверждено</span><strong>{exact(confirmedTotal)}</strong><small>Н1 — {exact(weekOneTotal)}, Н2 — {exact(weekTwoTotal)}, Н3 — {exact(weekThreeTotal)}, Н4 — {exact(currentWeekPaid)}.</small></article>
            <article className="stat"><span>Неделя 3 · факт</span><strong>{exact(weekThreeTotal)}</strong><small>Включая последние тортильи {exact(130)}, купленные на 30.08.</small></article>
            <article className="stat"><span>Неделя 4 · оплачено</span><strong>{exact(currentWeekPaid)}</strong><small>Чек {exact(3895.51)} + фрукты {exact(130)} + молоко {exact(140)}.</small></article>
            <article className="stat"><span>Резерв бюджета</span><strong>{exact(budget - confirmedTotal)}</strong><small>Оплачено всего {exact(confirmedTotal + mascarponeOutsidePlan)} с маскарпоне {exact(mascarponeOutsidePlan)} вне рациона.</small></article>
          </div>
          <div className="fact-grid">
            <article className="panel"><div className="panel-head"><h3>На что ушли деньги</h3><span>подтверждённые суммы</span></div><div className="category-list">{categories.map(([name, value]) => <div className="category" key={name}><div><span>{name}</span><strong>{exact(value)}</strong></div><div className="track"><span style={{ width: `${value / maxCategory * 100}%` }} /></div></div>)}</div></article>
            <div className="notes">
              <article className="note success"><span>Проверено</span><h3>Новый чек сходится</h3><p>22 товарные позиции чека 29.08 дают ровно {exact(3895.51)}. Отдельно сообщённые фрукты и молоко в нём отсутствуют, поэтому добавлены без задвоения.</p></article>
              <article className="note"><span>Без задвоения</span><h3>Тортильи не перенесены</h3><p>{exact(130)} за тортильи относятся к текущему дню и увеличили факт недели 3 до {exact(weekThreeTotal)}; в покупках недели 4 этой строки нет.</p></article>
              <article className="note warning"><span>Оценка, не факт</span><h3>Белая рыба выведена из рациона</h3><p>300 г не используются. Если остаток действительно будет выброшен, потенциальное списание по цене чека 22.08 составит около {money(108)}; пока оно не добавлено к подтверждённым потерям.</p></article>
            </div>
          </div>
          <details className="expenses"><summary>Все подтверждённые покупки за четыре недели</summary><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Позиция</th><th>Категория</th><th>Сумма</th></tr></thead><tbody>{confirmedPurchases.map((item) => <tr key={`${item.source}-${item.name}`}><td data-label="Источник">{item.source}</td><td data-label="Позиция">{item.name}</td><td data-label="Категория">{item.category}</td><td data-label="Сумма">{exact(item.amount)}</td></tr>)}</tbody></table></div></details>
        </section>

        <section className="section tint analysis-section" id="analysis"><div className="shell">
          <div className="section-heading"><div><span className="eyebrow">Промежуточный анализ</span><h2>Экономическая полезность продуктов</h2></div><p>Это не оценка брендов или вкуса: качество по фискальному чеку не доказано. Рейтинг опирается на цену, массу, роль в рационе и риск списания.</p></div>
          <div className="analysis-stats"><article><span>Средняя оплаченная неделя</span><strong>{exact(observedWeeklyAverage)}</strong><small>Четыре недели покупок, включая уже купленную четвёртую.</small></article><article><span>Темп четырёх недель</span><strong>{exact(runRateMonth)}</strong><small>Равен подтверждённому продуктовому итогу месяца.</small></article><article><span>Пригодный стартовый остаток</span><strong>{stock.length} позиций</strong><small>Белая рыба исключена и не уменьшает будущую закупку.</small></article></div>
          <div className="value-grid">{valueLeaders.map((item) => <article className="value-card" key={item.rank}><span className="value-rank">{item.rank}</span><div><span className="value-criterion">{item.criterion}</span><h3>{item.product}</h3><p className="value-evidence">{item.evidence}</p><p>{item.conclusion}</p></div></article>)}</div>
          <div className="signal-grid">{priceSignals.map((item) => <article className="signal-card" key={item.label}><span>{item.label}</span><h3>{item.evidence}</h3><p>{item.conclusion}</p></article>)}</div>
          <details className="expenses price-list"><summary>Нормализованные цены из чеков</summary><div className="table-wrap"><table><thead><tr><th>Продукт</th><th>Цена</th></tr></thead><tbody>{unitPrices.map(([name, value]) => <tr key={name}><td data-label="Продукт">{name}</td><td data-label="Цена">{value}</td></tr>)}</tbody></table></div></details>
          <p className="method-note"><strong>Метод.</strong> *Цена за 10 г белка и за 100 ккал — ориентир на типичные пищевые значения продуктов, а не данные чеков. Покупки без разбивки по весу — лавка на {exact(1035)} и сливы с персиками на {exact(130)} — входят в общий факт, но не в нормализованные цены.</p>
        </div></section>

        <section className="section shell" id="preferences">
          <div className="section-heading"><div><span className="eyebrow">Зафиксировано для планирования</span><h2>Вкусы и формула следующего месяца</h2></div><p>Текущая уже купленная неделя заблокирована от полной регенерации. Новая формула применяется к следующему месяцу после получения фактического остатка холодильника.</p></div>
          <div className="preference-grid">{foodPreferences.map((item) => <article className="preference-card" key={item.title}><span>{item.timing}</span><h3>{item.title}</h3><p>{item.rule}</p></article>)}</div>
          <div className="review-head"><span className="eyebrow">После завершения четырёх недель</span><h3>Как факт месяца превратится в новый план</h3><p>Проверяем не только чеки, но и реальное приготовление, отмены, размер порций, доедание и причины списаний.</p></div>
          <div className="review-grid">{nextMonthReviewProtocol.map((item, index) => <article key={item.label}><span>0{index + 1}</span><h4>{item.label}</h4><p>{item.check}</p><small>{item.result}</small></article>)}</div>
          <article className="planner-card">
            <div className="planner-intro"><div><span className="eyebrow">Расчётная модель</span><h3>Потребность → остаток → уже куплено → чистая закупка</h3></div><p>Ингредиенты складываются только в момент готовки. Доедание готовой порции не добавляет продукты второй раз. Остаток вычитается лишь тогда, когда он пригоден в дату блюда; затем дефицит округляется до реальной фасовки.</p></div>
            <div className="formula-chain"><span>Σ ингредиентов всех готовок</span><b>−</b><span>пригодные остатки дома</span><b>−</b><span>уже купленные партии</span><b>=</b><span>дефицит → фасовка</span></div>
            <div className="planner-example"><strong>Проверка механики, не готовая закупка сентября</strong><span>Ваш пример: если салатам нужно 900 г огурцов, а дома пригодны 700 г, купить нужно 200 г. Если 700 г помидоров уже покрывают 500 г рецептов, строка покупки равна нулю.</span></div>
            <div className="table-wrap"><table className="planner-table"><thead><tr><th>Продукт</th><th>Нужно</th><th>Дома</th><th>Уже куплено</th><th>Дефицит</th><th>Купить</th><th>Останется</th><th>Цена</th></tr></thead><tbody>{nextMonthFormulaPreview.map((row) => <tr key={row.productId}><td data-label="Продукт">{row.productName}{row.warning && <small className="planner-warning">{row.warning}</small>}</td><td data-label="Нужно">{amount(row.grossNeed, row.unit)}</td><td data-label="Дома">{amount(row.homeAvailable, row.unit)}</td><td data-label="Уже куплено">{amount(row.alreadyPurchasedAvailable, row.unit)}</td><td data-label="Дефицит">{amount(row.netDeficit, row.unit)}</td><td data-label="Купить">{amount(row.purchaseQuantity, row.unit)}{row.packageBreakdown.length > 0 && <small>{row.packageBreakdown.join(", ")}</small>}</td><td data-label="Останется">{amount(row.projectedRemainder, row.unit)}</td><td data-label="Цена">{exact(row.expectedCost)}</td></tr>)}</tbody></table></div>
            <p className="planner-note">Для следующего месяца расчёт также хранит дату блюда, срок годности партии и связь каждой покупки с рецептом. Скоропорт с лишней фасовкой будет помечен предупреждением, а не автоматически добавлен «на всякий случай».</p>
          </article>
        </section>

        <section className="section shell" id="stock"><div className="section-heading"><div><span className="eyebrow">Старт закупленной недели 4</span><h2>Пригодный домашний остаток</h2></div><p>Сначала используются фарши, овощное рагу, свежие овощи, яйца и сыры. Белая рыба исключена и не вычитается из потребности; сухие крупы остаются резервом.</p></div><div className="stock-grid">{stock.map((item) => <div className="stock-item" key={item.name}><span>{item.name}</span><strong>{item.quantity}</strong><small className={`stock-priority ${item.priority}`}>{item.priority === "сначала" ? "используем раньше" : "долгий запас"}</small></div>)}</div><p className="footnote">Остатки зафиксированы со слов пользователя 29 августа. Оба фарша находятся в морозилке; размораживайте их в холодильнике. Неупомянутые продукты не считаются запасом. Белая рыба 300 г вынесена за пределы расчёта, потому что пользователь больше не хочет её есть.</p></section>

        <section className="section shell" id="weeks">
          <div className="section-heading"><div><span className="eyebrow">Меню и архив</span><h2>Недели 1–4</h2></div><p>Недели 1–3 — архив факта и подробных рецептов, неделя 4 — купленная и зафиксированная. Порции рассчитаны на двух взрослых: ориентир основного ужина — около 550–750 ккал на человека, но точность зависит от бренда, масла и фактической порции.</p></div>
          <div className="tabs" role="tablist">{weeks.map((week) => <button type="button" role="tab" aria-selected={week.number === current.number} className={`${week.number === current.number ? "active" : ""} ${week.archived ? "archived-tab" : ""}`} key={week.number} onClick={() => setWeekNumber(week.number)}><span>{week.archived ? `Неделя ${week.number} · архив` : week.status === "purchased_locked" ? `Неделя ${week.number} · куплено` : `Неделя ${week.number}`}</span><strong>{week.archived ? exact(week.actualTotal ?? 0) : exact(week.status === "purchased_locked" ? total(week.purchases ?? []) : total(week.shopping))}</strong></button>)}</div>
          <div className="week-head"><div><span>0{current.number}</span><div><h3>{current.title}</h3><p>{current.focus}</p></div></div>{!current.archived && current.status !== "purchased_locked" && <button type="button" className="secondary" onClick={copyShopping}>{copyLabel}</button>}</div>
          <div className="variety" aria-label={`Разнообразие недели ${current.number}`}><strong>В ротации</strong>{current.variety.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="week-grid"><div><div className="subhead"><h3>Меню</h3><span>Нажмите на блюдо — внутри точные количества и 5–7 шагов</span></div><div className="meal-list">{current.meals.map((item, index) => <button className="meal" type="button" key={`${item.day}-${index}`} onClick={() => setSelected(item)}><span className="day">{item.day}<small>{item.type}</small></span><span className="dish">{item.title}<small>{item.batch}</small></span><span className="open">Рецепт</span></button>)}</div></div><aside className="prep"><span>{current.archived ? "Статус архива" : "Подготовка недели"}</span><ol>{current.prep.map((item) => <li key={item}>{item}</li>)}</ol></aside></div>
          {current.archived ? <article className="archive-panel"><span>Архив сохранён</span><p>{current.archiveNote}</p></article> : current.status === "purchased_locked" ? <div className="shopping purchased"><div className="shopping-head"><div><span className="lock-label">Закуплено · зафиксировано</span><h3>Фактические покупки недели {current.number}</h3><p>Это уже оплаченные позиции, а не повторный список «что купить». Подтверждённых новых строк закупки сейчас — {exact(currentRemainingTotal)}; наличие масла, горчицы и лимонного сока перед готовкой нужно проверить дома.</p></div><strong>{exact(currentPaidTotal)}</strong></div><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Раздел</th><th>Куплено</th><th>Количество</th><th>Факт</th></tr></thead><tbody>{(current.purchases ?? []).map((item, index) => <tr key={`${item.source}-${item.name}-${index}`}><td data-label="Источник">{item.source}</td><td data-label="Раздел">{item.category}</td><td data-label="Куплено">{item.name}{item.role === "extra" && <small className="extra-tag">вне основных рецептов</small>}{item.role === "snack" && <small className="extra-tag snack-tag">запланировано как перекус</small>}</td><td data-label="Количество">{item.quantity}</td><td data-label="Факт">{exact(item.price)}</td></tr>)}</tbody></table></div></div> : <div className="shopping"><div className="shopping-head"><div><h3>Закупка на неделю {current.number}</h3><p>Чистый список: только то, чего не хватает после остатков.</p></div><strong>{money(currentTabTotal)}</strong></div><div className="table-wrap"><table><thead><tr><th>Раздел</th><th>Что купить</th><th>Количество</th><th>Ориентир</th></tr></thead><tbody>{current.shopping.map((item, index) => <tr key={`${item.name}-${index}`}><td data-label="Раздел">{item.category}</td><td data-label="Что купить">{item.name}</td><td data-label="Количество">{item.quantity}</td><td data-label="Ориентир">{money(item.price)}</td></tr>)}</tbody></table></div></div>}
        </section>

        <section className="section forecast"><div className="shell forecast-card"><div><span className="eyebrow">Итоговый коридор месяца</span><h2>{money(forecastLow)}–{money(forecastHigh)}</h2><p>Подтверждённая продуктовая сумма уже составляет {exact(plannedMonth)}. Нижняя граница больше не опускается ниже оплаченного; верхняя добавляет до {money(1_000)} на возможные мелкие докупки до конца недели.</p></div><div className="forecast-weeks">{archivedWeeks.map((week) => <div key={week.number}><span>Неделя {week.number} · факт</span><strong>{exact(week.actualTotal ?? 0)}</strong></div>)}<div><span>Неделя 4 · оплачено</span><strong>{exact(currentWeekPaid)}</strong></div></div><p className="method"><strong>Факт продуктов:</strong> {exact(confirmedTotal)}. <strong>Вывод:</strong> текущая корзина не дублируется, белая рыба не считается полезным остатком, а огурцы и помидоры повторно не покупаются. <strong>Гипотеза:</strong> если дополнительных покупок будет не больше {money(1_000)}, бюджет сохранит не менее {money(Math.max(0, budget - forecastHigh))} резерва.</p></div></section>
      </main>
      <footer><div className="shell">Петербургский рацион · расчёт для двоих · август 2026</div></footer>

      {selected && <div className="backdrop"><button className="backdrop-dismiss" type="button" aria-label="Закрыть рецепт" onClick={() => setSelected(null)} /><section className="recipe" role="dialog" aria-modal="true" aria-labelledby="recipe-title"><div className="recipe-head"><div><span>{selected.day} · {selected.type}</span><h2 id="recipe-title">{selected.title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => setSelected(null)}>×</button></div><div className="recipe-meta"><span>{selected.recipe.time}</span><span>{selected.recipe.steps.length} шагов</span><span>{selected.batch}</span></div><div className="recipe-guide"><strong>Готовьте по порядку</strong><span>Все количества рассчитаны на {selected.recipe.portions}; нужные граммы повторяются прямо в шагах.</span></div><div className="recipe-body"><div><h3>Ингредиенты на {selected.recipe.portions}</h3><ul>{selected.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Пошаговое приготовление</h3><ol>{selected.recipe.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></div>{selected.recipe.note && <p className="recipe-note">{selected.recipe.note}</p>}</section></div>}
    </>
  );
}
