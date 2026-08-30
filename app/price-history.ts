export type PurchaseUnit = "g" | "kg" | "ml" | "l" | "pcs";
export type NormalizedPriceUnit = "kg" | "l" | "pcs";
export type PriceComparability = "exact" | "analog";
export type PriceChangeStatus = "cheaper" | "more_expensive" | "same" | "first_observation";
export type PriceValueSignal = "best_recorded" | "below_average" | "near_average" | "above_average" | "insufficient_history";

export type PriceObservation = {
  id: string;
  productKey: string;
  productName: string;
  comparability: PriceComparability;
  date: string;
  source: string;
  packageQuantity: number;
  packageUnit: PurchaseUnit;
  packageCount?: number;
  totalPrice: number;
};

export type NormalizedPriceObservation = {
  observation: PriceObservation;
  normalizedUnit: NormalizedPriceUnit;
  normalizedQuantity: number;
  unitPrice: number;
};

export type PriceHistoryComparison = {
  productKey: string;
  productName: string;
  normalizedUnit: NormalizedPriceUnit;
  current: PriceObservation;
  previous: PriceObservation | null;
  currentComparability: PriceComparability;
  currentComparabilityLabel: string;
  history: NormalizedPriceObservation[];
  currentUnitPrice: number;
  previousUnitPrice: number | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  historicalLow: number | null;
  historicalAverage: number | null;
  status: PriceChangeStatus;
  statusLabel: string;
  valueSignal: PriceValueSignal;
  valueLabel: string;
  summary: string;
};

const VALID_UNITS = new Set<PurchaseUnit>(["g", "kg", "ml", "l", "pcs"]);
const VALID_COMPARABILITY = new Set<PriceComparability>(["exact", "analog"]);
const NEAR_AVERAGE_PERCENT = 3;

export const priceStatusLabels: Record<PriceChangeStatus, string> = {
  cheaper: "Дешевле прошлой покупки",
  more_expensive: "Дороже прошлой покупки",
  same: "Цена не изменилась",
  first_observation: "Первая зафиксированная цена",
};

export const priceValueLabels: Record<PriceValueSignal, string> = {
  best_recorded: "Лучшая цена в истории",
  below_average: "Выгоднее обычного",
  near_average: "Обычная цена",
  above_average: "Дороже обычного",
  insufficient_history: "Недостаточно истории",
};

export const priceComparabilityLabels: Record<PriceComparability, string> = {
  exact: "Тот же товар — точное сравнение",
  analog: "Аналог или другой бренд — только ориентир",
};

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const roundMoney = (value: number) => Number(value.toFixed(2));
const roundPercent = (value: number) => Number(value.toFixed(1));

function normalizedUnitLabel(unit: NormalizedPriceUnit): string {
  if (unit === "pcs") return "шт.";
  return unit === "kg" ? "кг" : "л";
}

export function formatNormalizedPrice(price: number, unit: NormalizedPriceUnit): string {
  return `${moneyFormatter.format(price)} ₽/${normalizedUnitLabel(unit)}`;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} не может быть пустым.`);
}

function unitConversion(unit: PurchaseUnit): { normalizedUnit: NormalizedPriceUnit; multiplier: number } {
  switch (unit) {
    case "g": return { normalizedUnit: "kg", multiplier: 0.001 };
    case "kg": return { normalizedUnit: "kg", multiplier: 1 };
    case "ml": return { normalizedUnit: "l", multiplier: 0.001 };
    case "l": return { normalizedUnit: "l", multiplier: 1 };
    case "pcs": return { normalizedUnit: "pcs", multiplier: 1 };
    default: throw new Error(`Неизвестная единица измерения: ${String(unit)}.`);
  }
}

function normalizeObservation(observation: PriceObservation): NormalizedPriceObservation {
  const conversion = unitConversion(observation.packageUnit);
  const packageCount = observation.packageCount ?? 1;
  const normalizedQuantity = observation.packageQuantity * packageCount * conversion.multiplier;
  return {
    observation,
    normalizedUnit: conversion.normalizedUnit,
    normalizedQuantity,
    unitPrice: roundMoney(observation.totalPrice / normalizedQuantity),
  };
}

function validateObservation(observation: PriceObservation): void {
  assertNonEmpty(observation.id, "Идентификатор наблюдения");
  assertNonEmpty(observation.productKey, `Ключ продукта в наблюдении ${observation.id}`);
  assertNonEmpty(observation.productName, `Название продукта в наблюдении ${observation.id}`);
  assertNonEmpty(observation.source, `Источник цены в наблюдении ${observation.id}`);
  if (!VALID_COMPARABILITY.has(observation.comparability)) {
    throw new Error(`Сопоставимость в наблюдении ${observation.id} должна быть exact или analog.`);
  }
  if (!VALID_UNITS.has(observation.packageUnit)) {
    throw new Error(`Неизвестная единица измерения: ${String(observation.packageUnit)}.`);
  }
  if (!Number.isFinite(observation.packageQuantity) || observation.packageQuantity <= 0) {
    throw new Error(`Количество упаковки в наблюдении ${observation.id} должно быть положительным числом.`);
  }
  const packageCount = observation.packageCount ?? 1;
  if (!Number.isInteger(packageCount) || packageCount <= 0) {
    throw new Error(`Число упаковок в наблюдении ${observation.id} должно быть положительным целым числом.`);
  }
  if (!Number.isFinite(observation.totalPrice) || observation.totalPrice <= 0) {
    throw new Error(`Общая цена в наблюдении ${observation.id} должна быть положительным числом.`);
  }
  if (!Number.isFinite(Date.parse(observation.date))) {
    throw new Error(`Дата в наблюдении ${observation.id} имеет неверный формат.`);
  }
}

function changeStatus(current: number, previous: number | null): PriceChangeStatus {
  if (previous === null) return "first_observation";
  const delta = roundMoney(current - previous);
  if (delta === 0) return "same";
  return delta < 0 ? "cheaper" : "more_expensive";
}

function valueSignal(current: number, historicalLow: number | null, historicalAverage: number | null): PriceValueSignal {
  if (historicalLow === null || historicalAverage === null) return "insufficient_history";
  if (current <= historicalLow) return "best_recorded";
  const differenceFromAverage = ((current - historicalAverage) / historicalAverage) * 100;
  if (differenceFromAverage < -NEAR_AVERAGE_PERCENT) return "below_average";
  if (differenceFromAverage <= NEAR_AVERAGE_PERCENT) return "near_average";
  return "above_average";
}

function buildSummary(input: {
  productName: string;
  currentComparability: PriceComparability;
  unit: NormalizedPriceUnit;
  current: number;
  previous: NormalizedPriceObservation | null;
  absoluteDelta: number | null;
  percentDelta: number | null;
  historicalLow: number | null;
  historicalAverage: number | null;
  status: PriceChangeStatus;
  value: PriceValueSignal;
}): string {
  const currentPrice = formatNormalizedPrice(input.current, input.unit);
  const isAnalogComparison = input.currentComparability === "analog"
    || input.previous?.observation.comparability === "analog";
  if (!input.previous || input.absoluteDelta === null || input.percentDelta === null) {
    if (input.currentComparability === "analog") {
      return `${input.productName}: сейчас ${currentPrice}; сравнение аналога/другого бренда, ориентир. Данных для динамики пока нет.`;
    }
    return `${input.productName}: первая зафиксированная цена — ${currentPrice}.`;
  }

  let comparison: string;
  if (input.status === "same") {
    comparison = `цена не изменилась относительно покупки ${input.previous.observation.date}`;
  } else {
    const direction = input.status === "cheaper" ? "дешевле" : "дороже";
    const signedPercent = input.percentDelta > 0 ? `+${percentFormatter.format(input.percentDelta)}` : percentFormatter.format(input.percentDelta);
    comparison = `${direction} на ${formatNormalizedPrice(Math.abs(input.absoluteDelta), input.unit)} (${signedPercent}%) относительно покупки ${input.previous.observation.date}`;
  }

  let valueContext = "";
  if (input.value === "best_recorded" && input.historicalLow !== null) {
    valueContext = input.current < input.historicalLow
      ? ` Новый минимум; прежний минимум — ${formatNormalizedPrice(input.historicalLow, input.unit)}.`
      : " Цена совпадает с лучшей ранее зафиксированной.";
  } else if (input.historicalAverage !== null) {
    const relation = input.value === "below_average"
      ? "ниже"
      : input.value === "above_average"
        ? "выше"
        : "около";
    valueContext = ` Это ${relation} прежней средней цены ${formatNormalizedPrice(input.historicalAverage, input.unit)}.`;
  }

  const comparisonPrefix = isAnalogComparison
    ? `${input.productName}: сейчас ${currentPrice}; сравнение аналога/другого бренда, ориентир: `
    : `${input.productName}: сейчас ${currentPrice}, `;
  return `${comparisonPrefix}${comparison}.${valueContext}`;
}

export function analyzePriceHistory(observations: PriceObservation[]): PriceHistoryComparison[] {
  const ids = new Set<string>();
  const grouped = new Map<string, Array<{ normalized: NormalizedPriceObservation; timestamp: number; index: number }>>();

  observations.forEach((observation, index) => {
    validateObservation(observation);
    if (ids.has(observation.id)) {
      throw new Error(`Идентификатор наблюдения ${observation.id} используется повторно.`);
    }
    ids.add(observation.id);
    const normalized = normalizeObservation(observation);
    const group = grouped.get(observation.productKey) ?? [];
    const knownUnit = group[0]?.normalized.normalizedUnit;
    if (knownUnit && knownUnit !== normalized.normalizedUnit) {
      throw new Error(`Для продукта ${observation.productKey} указаны несовместимые единицы измерения.`);
    }
    group.push({ normalized, timestamp: Date.parse(observation.date), index });
    grouped.set(observation.productKey, group);
  });

  return [...grouped.entries()].map(([productKey, entries]) => {
    entries.sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
    const currentEntry = entries.at(-1)!;
    const current = currentEntry.normalized;
    const previous = entries.length > 1 ? entries.at(-2)!.normalized : null;
    const priorPrices = entries.slice(0, -1).map((entry) => entry.normalized.unitPrice);
    const historicalLow = priorPrices.length > 0 ? roundMoney(Math.min(...priorPrices)) : null;
    const historicalAverage = priorPrices.length > 0
      ? roundMoney(priorPrices.reduce((sum, price) => sum + price, 0) / priorPrices.length)
      : null;
    const absoluteDelta = previous ? roundMoney(current.unitPrice - previous.unitPrice) : null;
    const percentDelta = previous
      ? roundPercent(((current.unitPrice - previous.unitPrice) / previous.unitPrice) * 100)
      : null;
    const status = changeStatus(current.unitPrice, previous?.unitPrice ?? null);
    const value = valueSignal(current.unitPrice, historicalLow, historicalAverage);

    return {
      productKey,
      productName: current.observation.productName,
      normalizedUnit: current.normalizedUnit,
      current: current.observation,
      previous: previous?.observation ?? null,
      currentComparability: current.observation.comparability,
      currentComparabilityLabel: priceComparabilityLabels[current.observation.comparability],
      history: entries.map((entry) => entry.normalized),
      currentUnitPrice: current.unitPrice,
      previousUnitPrice: previous?.unitPrice ?? null,
      absoluteDelta,
      percentDelta,
      historicalLow,
      historicalAverage,
      status,
      statusLabel: priceStatusLabels[status],
      valueSignal: value,
      valueLabel: priceValueLabels[value],
      summary: buildSummary({
        productName: current.observation.productName,
        currentComparability: current.observation.comparability,
        unit: current.normalizedUnit,
        current: current.unitPrice,
        previous,
        absoluteDelta,
        percentDelta,
        historicalLow,
        historicalAverage,
        status,
        value,
      }),
    };
  });
}
