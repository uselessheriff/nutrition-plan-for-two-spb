import { analyzePriceHistory, formatNormalizedPrice, type PriceHistoryComparison } from "./price-history";
import { excludedPriceProductKeys, priceHistoryDataNotes, priceObservations } from "./price-observations";

const percent = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" });

const rows = analyzePriceHistory(priceObservations);
const comparedRows = rows
  .filter((row) => row.previous !== null)
  .sort((left, right) => Math.abs(right.percentDelta ?? 0) - Math.abs(left.percentDelta ?? 0));
const baselineRows = rows.filter((row) => row.previous === null);
const exactComparedRows = comparedRows.filter((row) => row.currentComparability === "exact");
const cheaperExactCount = exactComparedRows.filter((row) => row.status === "cheaper").length;
const expensiveExactCount = exactComparedRows.filter((row) => row.status === "more_expensive").length;
const analogCount = comparedRows.filter((row) => row.currentComparability === "analog").length;

function dateLabel(value: string): string {
  return shortDate.format(new Date(`${value}T12:00:00`));
}

function deltaLabel(row: PriceHistoryComparison): string {
  if (row.absoluteDelta === null || row.percentDelta === null) return "Нет прошлой цены";
  if (row.absoluteDelta === 0) return "0,00 ₽ · 0,0%";
  const sign = row.absoluteDelta > 0 ? "+" : "−";
  return `${sign}${formatNormalizedPrice(Math.abs(row.absoluteDelta), row.normalizedUnit)} · ${sign}${percent.format(Math.abs(row.percentDelta))}%`;
}

function purchaseEffect(row: PriceHistoryComparison): string | null {
  if (row.absoluteDelta === null || row.absoluteDelta === 0) return null;
  const currentQuantity = row.history.at(-1)?.normalizedQuantity ?? 0;
  const effect = row.absoluteDelta * currentQuantity;
  const sign = effect > 0 ? "+" : "−";
  return `На текущий объём: ${sign}${money.format(Math.abs(effect))} ₽`;
}

export function PriceMemory() {
  return (
    <section className="price-memory" aria-labelledby="price-memory-title">
      <div className="section-heading compact-heading">
        <div><span className="eyebrow">История из чеков</span><h2 id="price-memory-title">Память цен</h2></div>
        <p>Каждая новая покупка сохраняется числом и сравнивается в ₽/кг, ₽/л или ₽/шт. Аналоги отмечены отдельно: это ориентир, а не доказанное изменение цены того же товара.</p>
      </div>

      <div className="price-memory-stats">
        <article><span>Наблюдений</span><strong>{priceObservations.length}</strong><small>Покупки с датой, количеством и ценой.</small></article>
        <article><span>Точно дешевле</span><strong>{cheaperExactCount}</strong><small>Тот же товар стал дешевле прошлой покупки.</small></article>
        <article><span>Точно дороже</span><strong>{expensiveExactCount}</strong><small>Тот же товар стал дороже прошлой покупки.</small></article>
        <article><span>Сравнений-аналогов</span><strong>{analogCount}</strong><small>Отдельные ориентиры по брендам и заменам.</small></article>
      </div>

      <div className="table-wrap price-memory-table"><table><thead><tr><th>Продукт</th><th>Было</th><th>Сейчас</th><th>Изменение</th><th>Вывод</th></tr></thead><tbody>{comparedRows.map((row) => {
        const excluded = excludedPriceProductKeys.has(row.productKey);
        return <tr key={row.productKey} className={excluded ? "price-row-excluded" : undefined}>
          <td data-label="Продукт"><strong>{row.productName}</strong><small className={`compare-badge ${row.currentComparability}`}>{row.currentComparabilityLabel}</small>{excluded && <small className="excluded-badge">Исключён из рациона</small>}</td>
          <td data-label="Было">{formatNormalizedPrice(row.previousUnitPrice ?? 0, row.normalizedUnit)}<small>{dateLabel(row.previous?.date ?? "")} · {row.previous?.source}</small></td>
          <td data-label="Сейчас">{formatNormalizedPrice(row.currentUnitPrice, row.normalizedUnit)}<small>{dateLabel(row.current.date)} · {row.current.source}</small></td>
          <td data-label="Изменение"><span className={`price-delta ${row.status}`}>{deltaLabel(row)}</span>{purchaseEffect(row) && <small>{purchaseEffect(row)}</small>}</td>
          <td data-label="Вывод"><strong>{excluded ? "Не считать выгодой" : row.statusLabel}</strong><small>{excluded ? "Продукт не съеден/не нравится: низкая цена не компенсирует списание." : row.valueLabel}</small></td>
        </tr>;
      })}</tbody></table></div>

      <details className="price-baselines"><summary>Первые цены без базы сравнения · {baselineRows.length}</summary><div className="baseline-grid">{baselineRows.map((row) => <article key={row.productKey}><span>{row.productName}</span><strong>{formatNormalizedPrice(row.currentUnitPrice, row.normalizedUnit)}</strong><small>{dateLabel(row.current.date)} · нет предыдущей сопоставимой покупки</small></article>)}</div></details>
      <div className="price-data-notes">{priceHistoryDataNotes.map((note) => <p key={note}>{note}</p>)}</div>
      <p className="planner-note"><strong>Как обновляется:</strong> вы присылаете чек в GPT, я добавляю разобранные позиции и цены в эту историю. Файлы чеков на публичный сайт не публикуются. Если у позиции нет веса, даты или понятной единицы, сайт честно показывает отсутствие сравнения, а не придумывает цену.</p>
    </section>
  );
}
