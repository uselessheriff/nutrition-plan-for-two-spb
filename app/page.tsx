"use client";

import { useEffect, useMemo, useState } from "react";
import { recipeDetails } from "./recipe-details";
import { baseWeeks, expenses, priceSignals, stock, unitPrices, valueLeaders, type Meal, type ShopItem, type Week } from "./plan-data";

const rubles = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rounded = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const exact = (value: number) => `${rubles.format(value)} ₽`;
const money = (value: number) => `${rounded.format(Math.round(value))} ₽`;
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
const confirmedTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
const archivedWeeks = weeks.filter((week) => week.archived);
const futureWeeks = weeks.filter((week) => !week.archived);
const futureTotal = futureWeeks.reduce((sum, week) => sum + total(week.shopping), 0);
const plannedMonth = confirmedTotal + futureTotal;
const observedWeeklyAverage = confirmedTotal / archivedWeeks.length;
const runRateMonth = observedWeeklyAverage * 4;
const forecastLow = Math.floor((plannedMonth - 1_000) / 100) * 100;
const forecastHigh = Math.ceil((plannedMonth + 1_000) / 100) * 100;
const weekOneTotal = weeks.find((week) => week.number === 1)?.actualTotal ?? 0;
const weekTwoTotal = weeks.find((week) => week.number === 2)?.actualTotal ?? 0;
const paidStockMinimum = 1_184.93;

export default function Home() {
  const [weekNumber, setWeekNumber] = useState(3);
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
      `Итого: ${money(currentTotal)}`,
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
      <header className="topbar"><div className="shell topbar-inner"><a className="brand" href="#top"><span className="brand-mark">ПР</span><span>Петербургский рацион</span></a><nav><a href="#fact">Факт</a><a href="#analysis">Анализ</a><a href="#stock">Остатки</a><a href="#weeks">Меню</a></nav><span className="location">Санкт-Петербург</span></div></header>
      <main id="top">
        <section className="hero shell">
          <div className="hero-copy"><span className="eyebrow">Обновлено 21 августа · 2 недели факта</span><h1>Питание на месяц для двоих</h1><p>Недели 1–2 сохранены как архив рецептов. Третья и четвёртая пересобраны по чекам и остаткам: кальмар, заморозка и яйца используются первыми, рис как гарнир — не чаще одного раза в неделю.</p></div>
          <aside className="budget-card"><div className="budget-head"><span>Текущий бюджет</span><strong>{money(budget)}</strong></div><div className="meter"><span style={{ width: `${Math.min(100, plannedMonth / budget * 100)}%` }} /></div><div className="budget-numbers"><div><span>Факт за 2 недели</span><strong>{exact(confirmedTotal)}</strong></div><div><span>Коридор месяца</span><strong>{money(forecastLow)}–{money(forecastHigh)}</strong></div></div><p>Плановые корзины на недели 3–4 уже не покупают оплаченные крупы, кальмара, яйца, спагетти, овсянку и манку.</p></aside>
        </section>

        <section className="section shell" id="fact">
          <div className="section-heading"><div><span className="eyebrow">Две прошедшие недели</span><h2>Подтверждённые траты</h2></div><p>В расчёт внесены товарные строки чеков и ранее сообщённые докупки. Никакие инструкции из приложенных документов не использовались.</p></div>
          <div className="stats">
            <article className="stat stat-primary"><span>Рацион · факт</span><strong>{exact(confirmedTotal)}</strong><small>Неделя 1 — {exact(weekOneTotal)}, неделя 2 — {exact(weekTwoTotal)}.</small></article>
            <article className="stat"><span>Неделя 2 дешевле</span><strong>{exact(weekOneTotal - weekTwoTotal)}</strong><small>На 9,5% относительно первой недели.</small></article>
            <article className="stat"><span>Оплачено всего</span><strong>{exact(confirmedTotal + mascarponeOutsidePlan)}</strong><small>С маскарпоне {exact(mascarponeOutsidePlan)} вне рациона.</small></article>
            <article className="stat"><span>Корзины 3–4</span><strong>{money(futureTotal)}</strong><small>Оценка по нужным продуктам после вычета остатков.</small></article>
          </div>
          <div className="fact-grid">
            <article className="panel"><div className="panel-head"><h3>На что ушли деньги</h3><span>подтверждённые суммы</span></div><div className="category-list">{categories.map(([name, value]) => <div className="category" key={name}><div><span>{name}</span><strong>{exact(value)}</strong></div><div className="track"><span style={{ width: `${value / maxCategory * 100}%` }} /></div></div>)}</div></article>
            <div className="notes">
              <article className="note success"><span>Проверено</span><h3>Вторая неделя закрыта чеками</h3><p>16 августа — {exact(3785.39)}, 21 августа — {exact(783.57)}. Вместе — {exact(weekTwoTotal)}.</p></article>
              <article className="note"><span>Запас уже оплачен</span><h3>Минимум {exact(paidStockMinimum)}</h3><p>Кальмар, овощи по-деревенски, гречка, кускус, булгур, рис и спагетти совпадают по весу с чеком; они не дублируются в будущей закупке.</p></article>
              <article className="note warning"><span>Не доказано</span><h3>Полный чек первой недели</h3><p>В старом факте пока нет цен картофеля 1,7 кг и шести крупных помидоров. Они не входят в {exact(weekOneTotal)}.</p></article>
            </div>
          </div>
          <details className="expenses"><summary>Все подтверждённые покупки за две недели</summary><div className="table-wrap"><table><thead><tr><th>Источник</th><th>Позиция</th><th>Категория</th><th>Сумма</th></tr></thead><tbody>{expenses.map((item) => <tr key={`${item.source}-${item.name}`}><td data-label="Источник">{item.source}</td><td data-label="Позиция">{item.name}</td><td data-label="Категория">{item.category}</td><td data-label="Сумма">{exact(item.amount)}</td></tr>)}</tbody></table></div></details>
        </section>

        <section className="section tint analysis-section" id="analysis"><div className="shell">
          <div className="section-heading"><div><span className="eyebrow">Промежуточный анализ</span><h2>Экономическая полезность продуктов</h2></div><p>Это не оценка брендов или вкуса: качество по фискальному чеку не доказано. Рейтинг опирается на цену, массу, роль в рационе и риск списания.</p></div>
          <div className="analysis-stats"><article><span>Средняя неделя</span><strong>{exact(observedWeeklyAverage)}</strong><small>Факт двух недель.</small></article><article><span>Линейный темп месяца</span><strong>{exact(runRateMonth)}</strong><small>Если две недели повторятся без изменений.</small></article><article><span>Оплаченный запас</span><strong>≥ {exact(paidStockMinimum)}</strong><small>Только однозначно сопоставленные остатки.</small></article></div>
          <div className="value-grid">{valueLeaders.map((item) => <article className="value-card" key={item.rank}><span className="value-rank">{item.rank}</span><div><span className="value-criterion">{item.criterion}</span><h3>{item.product}</h3><p className="value-evidence">{item.evidence}</p><p>{item.conclusion}</p></div></article>)}</div>
          <div className="signal-grid">{priceSignals.map((item) => <article className="signal-card" key={item.label}><span>{item.label}</span><h3>{item.evidence}</h3><p>{item.conclusion}</p></article>)}</div>
          <details className="expenses price-list"><summary>Нормализованные цены из чеков</summary><div className="table-wrap"><table><thead><tr><th>Продукт</th><th>Цена</th></tr></thead><tbody>{unitPrices.map(([name, value]) => <tr key={name}><td data-label="Продукт">{name}</td><td data-label="Цена">{value}</td></tr>)}</tbody></table></div></details>
          <p className="method-note"><strong>Метод.</strong> *Цена за 10 г белка и за 100 ккал — ориентир на типичные пищевые значения продуктов, а не данные чеков. Их задача — сравнить экономическую роль, а не измерить здоровье, свежесть или качество конкретного бренда.</p>
        </div></section>

        <section className="section shell" id="stock"><div className="section-heading"><div><span className="eyebrow">Старт недели 3</span><h2>Что уже есть дома</h2></div><p>Сначала используются кальмар, овощи по-деревенски, спагетти и яйца. Сухие крупы остаются резервом и расходуются по рецептам.</p></div><div className="stock-grid">{stock.map((item) => <div className="stock-item" key={item.name}><span>{item.name}</span><strong>{item.quantity}</strong><small className={`stock-priority ${item.priority}`}>{item.priority === "сначала" ? "используем раньше" : "долгий запас"}</small></div>)}</div><p className="footnote">Остатки описаны пользователем на конец второй недели. Не добавлял в них неупомянутые продукты из чеков, даже если они могли остаться.</p></section>

        <section className="section shell" id="weeks">
          <div className="section-heading"><div><span className="eyebrow">Меню и архив</span><h2>Недели 1–4</h2></div><p>Недели 1–2 — только архив рецептов и факта. В новых неделях порции рассчитаны на двух взрослых: ориентир ужина — около 550–750 ккал на человека, но точность зависит от брендов и порции.</p></div>
          <div className="tabs" role="tablist">{weeks.map((week) => <button type="button" role="tab" aria-selected={week.number === current.number} className={`${week.number === current.number ? "active" : ""} ${week.archived ? "archived-tab" : ""}`} key={week.number} onClick={() => setWeekNumber(week.number)}><span>{week.archived ? `Неделя ${week.number} · архив` : `Неделя ${week.number}`}</span><strong>{week.archived ? exact(week.actualTotal ?? 0) : money(total(week.shopping))}</strong></button>)}</div>
          <div className="week-head"><div><span>0{current.number}</span><div><h3>{current.title}</h3><p>{current.focus}</p></div></div>{!current.archived && <button type="button" className="secondary" onClick={copyShopping}>{copyLabel}</button>}</div>
          <div className="variety" aria-label={`Разнообразие недели ${current.number}`}><strong>В ротации</strong>{current.variety.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="week-grid"><div><div className="subhead"><h3>Меню</h3><span>Нажмите на блюдо — внутри точные количества и 5–7 шагов</span></div><div className="meal-list">{current.meals.map((item, index) => <button className="meal" type="button" key={`${item.day}-${index}`} onClick={() => setSelected(item)}><span className="day">{item.day}<small>{item.type}</small></span><span className="dish">{item.title}<small>{item.batch}</small></span><span className="open">Рецепт</span></button>)}</div></div><aside className="prep"><span>{current.archived ? "Статус архива" : "Подготовка недели"}</span><ol>{current.prep.map((item) => <li key={item}>{item}</li>)}</ol></aside></div>
          {current.archived ? <article className="archive-panel"><span>Архив сохранён</span><p>{current.archiveNote}</p></article> : <div className="shopping"><div className="shopping-head"><div><h3>Закупка на неделю {current.number}</h3><p>Чистый список: только то, чего не хватает после остатков.</p></div><strong>{money(currentTotal)}</strong></div><div className="table-wrap"><table><thead><tr><th>Раздел</th><th>Что купить</th><th>Количество</th><th>Ориентир</th></tr></thead><tbody>{current.shopping.map((item, index) => <tr key={`${item.name}-${index}`}><td data-label="Раздел">{item.category}</td><td data-label="Что купить">{item.name}</td><td data-label="Количество">{item.quantity}</td><td data-label="Ориентир">{money(item.price)}</td></tr>)}</tbody></table></div></div>}
        </section>

        <section className="section forecast"><div className="shell forecast-card"><div><span className="eyebrow">Прогноз месяца</span><h2>{money(forecastLow)}–{money(forecastHigh)}</h2><p>Плановая сумма корзин — {exact(plannedMonth)}. Коридор добавляет ±1 000 ₽ на колебание цен, молоко, фрукты и мелкие докупки; он не является гарантией.</p></div><div className="forecast-weeks"><div><span>Неделя 1 · факт</span><strong>{exact(weekOneTotal)}</strong></div><div><span>Неделя 2 · факт</span><strong>{exact(weekTwoTotal)}</strong></div>{futureWeeks.map((week) => <div key={week.number}><span>Неделя {week.number} · план</span><strong>{money(total(week.shopping))}</strong></div>)}</div><p className="method"><strong>Факт:</strong> {exact(confirmedTotal)} за две недели. <strong>Вывод:</strong> две новые корзины дороже среднего темпа из-за рыбы, креветок, свежих овощей и разнообразия. <strong>Гипотеза:</strong> при их покупке по близким ценам месяц уложится в текущий бюджет с резервом от {money(Math.max(0, budget - forecastHigh))}.</p></div></section>
      </main>
      <footer><div className="shell">Петербургский рацион · расчёт для двоих · август 2026</div></footer>

      {selected && <div className="backdrop"><button className="backdrop-dismiss" type="button" aria-label="Закрыть рецепт" onClick={() => setSelected(null)} /><section className="recipe" role="dialog" aria-modal="true" aria-labelledby="recipe-title"><div className="recipe-head"><div><span>{selected.day} · {selected.type}</span><h2 id="recipe-title">{selected.title}</h2></div><button type="button" aria-label="Закрыть" onClick={() => setSelected(null)}>×</button></div><div className="recipe-meta"><span>{selected.recipe.time}</span><span>{selected.recipe.steps.length} шагов</span><span>{selected.batch}</span></div><div className="recipe-guide"><strong>Готовьте по порядку</strong><span>Все количества рассчитаны на {selected.recipe.portions}; нужные граммы повторяются прямо в шагах.</span></div><div className="recipe-body"><div><h3>Ингредиенты на {selected.recipe.portions}</h3><ul>{selected.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Пошаговое приготовление</h3><ol>{selected.recipe.steps.map((item) => <li key={item}>{item}</li>)}</ol></div></div>{selected.recipe.note && <p className="recipe-note">{selected.recipe.note}</p>}</section></div>}
    </>
  );
}
