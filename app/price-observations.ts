import type { PriceObservation, PriceComparability, PurchaseUnit } from "./price-history";

const observation = (
  id: string,
  productKey: string,
  productName: string,
  date: string,
  source: string,
  packageQuantity: number,
  packageUnit: PurchaseUnit,
  totalPrice: number,
  comparability: PriceComparability,
  packageCount = 1,
): PriceObservation => ({
  id,
  productKey,
  productName,
  date,
  source,
  packageQuantity,
  packageUnit,
  packageCount,
  totalPrice,
  comparability,
});

// Числовая память цен. В неё попадают только позиции с известной датой,
// количеством и базовой единицей; агрегированные покупки без веса остаются
// в журнале расходов, но не участвуют в сравнении ₽/кг, ₽/л или ₽/шт.
export const priceObservations: PriceObservation[] = [
  observation("milk-domik-2026-08-21", "milk_domik", "Молоко «Домик в деревне» 3,2%", "2026-08-21", "Чек 21.08", 1.9, "l", 209.9, "exact"),
  observation("milk-domik-2026-08-29", "milk_domik", "Молоко «Домик в деревне» 3,2%", "2026-08-29", "Чек «Лента» 29.08", 1.9, "l", 192.99, "exact"),

  observation("turkey-pava-2026-08-16", "turkey_pava", "Фарш индейки Pava Pava", "2026-08-16", "Чек 16.08", 450, "g", 269.99, "exact"),
  observation("turkey-pava-2026-08-22", "turkey_pava", "Фарш индейки Pava Pava", "2026-08-22", "Чек «Лента» 22.08", 450, "g", 249.99, "exact"),

  observation("milk-prosto-2026-08-16", "milk_prostokvashino", "Молоко «Простоквашино»", "2026-08-16", "Чек 16.08", 1.4, "l", 149.99, "exact"),
  observation("milk-prosto-2026-08-22", "milk_prostokvashino", "Молоко «Простоквашино»", "2026-08-22", "Чек «Лента» 22.08", 1.4, "l", 149.99, "exact"),

  observation("chicken-thigh-2026-08-16", "chicken_thigh", "Филе куриного бедра", "2026-08-16", "Чек 16.08", 790, "g", 434.49, "exact"),
  observation("chicken-thigh-a-2026-08-22", "chicken_thigh", "Филе куриного бедра", "2026-08-22", "Чек «Лента» 22.08 · упаковка 1", 775, "g", 426.24, "exact"),
  observation("chicken-thigh-b-2026-08-22", "chicken_thigh", "Филе куриного бедра", "2026-08-22", "Чек «Лента» 22.08 · упаковка 2", 883, "g", 485.64, "exact"),

  observation("fetaxa-2026-08-13", "fetaxa", "Фетакса", "2026-08-13", "Чек 13.08", 200, "g", 159.99, "exact"),
  observation("fetaxa-2026-08-22", "fetaxa", "Фетакса", "2026-08-22", "Чек «Лента» 22.08", 200, "g", 159.99, "exact"),
  observation("curd-2026-08-16", "curd_9", "Творог 9%", "2026-08-16", "Чек 16.08", 400, "g", 199.99, "exact"),
  observation("curd-2026-08-22", "curd_9", "Творог 9%", "2026-08-22", "Чек «Лента» 22.08", 400, "g", 199.99, "exact"),

  observation("spaghetti-barilla-2026-08-13", "spaghetti", "Спагетти", "2026-08-13", "Barilla · чек 13.08", 450, "g", 94.99, "exact"),
  observation("spaghetti-dobrodeya-2026-08-16", "spaghetti", "Спагетти «Добродея»", "2026-08-16", "Чек 16.08 · замена бренда", 400, "g", 74.99, "analog"),
  observation("spaghetti-dobrodeya-2026-08-29", "spaghetti", "Спагетти «Добродея»", "2026-08-29", "Чек «Лента» 29.08", 400, "g", 74.99, "exact"),

  observation("pangasius-2026-08-16", "pangasius", "Пангасиус", "2026-08-16", "Чек 16.08", 700, "g", 251.99, "exact"),
  observation("pangasius-2026-08-22", "pangasius", "Пангасиус", "2026-08-22", "Чек «Лента» 22.08", 1.008, "kg", 362.87, "exact"),

  observation("banana-2026-08-16", "bananas", "Бананы", "2026-08-16", "Чек 16.08", 969, "g", 106.58, "analog"),
  observation("banana-2026-08-21", "bananas", "Бананы", "2026-08-21", "Чек 21.08", 840, "g", 92.32, "analog"),

  observation("tomato-base-2026-08-22", "tomato_base", "Томатная основа", "2026-08-22", "Пассата · чек «Лента» 22.08", 500, "g", 259.98, "exact", 2),
  observation("tomato-base-2026-08-29", "tomato_base", "Томатная основа Pomi", "2026-08-29", "Pomi · чек «Лента» 29.08", 500, "g", 899.97, "analog", 3),

  observation("beef-mince-2026-08-13", "beef_mince", "Фарш говяжий", "2026-08-13", "Чек 13.08", 400, "g", 314.99, "exact"),
  observation("beef-mince-2026-08-22", "beef_mince", "Фарш говяжий Samson", "2026-08-22", "Чек «Лента» 22.08", 750, "g", 779.99, "analog"),

  observation("pepper-2026-08-13", "red_pepper", "Красный перец", "2026-08-13", "Чек 13.08", 124, "g", 34.72, "analog"),
  observation("pepper-2026-08-16", "red_pepper", "Красный перец", "2026-08-16", "Чек 16.08", 178, "g", 46.28, "analog"),
  observation("pepper-2026-08-21", "red_pepper", "Красный перец", "2026-08-21", "Чек 21.08", 410, "g", 104.47, "analog"),
  observation("pepper-2026-08-29", "red_pepper", "Красный перец", "2026-08-29", "Чек «Лента» 29.08", 219, "g", 67.89, "analog"),

  observation("greek-yogurt-2026-08-16", "greek_yogurt", "Греческий йогурт", "2026-08-16", "Простоквашино · чек 16.08", 135, "g", 56.99, "analog"),
  observation("greek-yogurt-2026-08-22", "greek_yogurt", "Греческий йогурт", "2026-08-22", "Чек «Лента» 22.08", 250, "g", 159.98, "analog", 2),
  observation("greek-yogurt-2026-08-29", "greek_yogurt", "Греческий йогурт TEOS", "2026-08-29", "Чек «Лента» 29.08", 250, "g", 254.97, "analog", 3),

  observation("broccoli-2026-08-16", "broccoli", "Брокколи замороженная", "2026-08-16", "Чек 16.08", 400, "g", 189.99, "exact"),
  observation("broccoli-2026-08-29", "broccoli", "Брокколи «Морозко Green»", "2026-08-29", "Чек «Лента» 29.08", 400, "g", 199.99, "analog"),
  observation("mushroom-2026-08-13", "mushrooms", "Шампиньоны", "2026-08-13", "Чек 13.08", 250, "g", 82.99, "analog"),
  observation("mushroom-2026-08-29", "mushrooms", "Шампиньоны", "2026-08-29", "Чек «Лента» 29.08", 400, "g", 109.99, "analog"),
  observation("tomato-fresh-2026-08-16", "fresh_tomatoes", "Свежие томаты", "2026-08-16", "Розовые · чек 16.08", 783, "g", 133.1, "analog"),
  observation("tomato-fresh-2026-08-21", "fresh_tomatoes", "Свежие томаты", "2026-08-21", "Обычные · чек 21.08", 560, "g", 55.99, "analog"),

  // Первые наблюдения: уже сохранены и станут базой при следующей покупке.
  observation("apple-2026-08-29", "apples", "Яблоки «Криппс Пинк»", "2026-08-29", "Чек «Лента» 29.08", 698, "g", 118.65, "exact"),
  observation("eggplant-2026-08-29", "eggplant", "Баклажаны грунтовые", "2026-08-29", "Чек «Лента» 29.08", 695, "g", 62.54, "exact"),
  observation("spinach-2026-08-29", "spinach", "Шпинат", "2026-08-29", "Чек «Лента» 29.08", 125, "g", 169.99, "exact"),
  observation("lettuce-2026-08-29", "lettuce_pot", "Салат листовой в горшочке", "2026-08-29", "Чек «Лента» 29.08", 1, "pcs", 69.99, "exact"),
  observation("shoti-2026-08-29", "shoti_puri", "Шоти-пури", "2026-08-29", "Чек «Лента» 29.08", 400, "g", 89.99, "exact"),
  observation("shrimp-2026-08-29", "shrimp", "Креветки очищенные", "2026-08-29", "Чек «Лента» 29.08", 300, "g", 549.99, "exact"),
  observation("white-beans-2026-08-29", "white_beans_can", "Фасоль белая Bonduelle", "2026-08-29", "Чек «Лента» 29.08", 1, "pcs", 259.98, "exact", 2),
  observation("chicken-fillet-2026-08-29", "chicken_fillet", "Филе куриное «Петелинка»", "2026-08-29", "Чек «Лента» 29.08", 766, "g", 413.63, "exact"),
  observation("milk-unbranded-2026-08-30", "milk_unbranded", "Молоко без уточнения бренда", "2026-08-30", "Со слов пользователя", 1.7, "l", 140, "analog"),
];

export const excludedPriceProductKeys = new Set(["pangasius"]);

export const priceHistoryDataNotes = [
  "Точное сравнение — тот же продукт/бренд/формат; аналог всегда помечается как ориентир.",
  "Позиции без веса, даты или понятной единицы хранятся в расходах, но не искажают цену за килограмм или литр.",
  "Выгода учитывает не только цену: исключённые, испорченные или не съеденные продукты не считаются удачной покупкой.",
];
