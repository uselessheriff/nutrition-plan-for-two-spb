export type BaseUnit = "g" | "ml" | "pcs";
export type InventorySource = "home" | "already_purchased";
export type PlanStatus = "draft" | "purchased_locked" | "actual";

export type ProductDefinition = {
  id: string;
  name: string;
  unit: BaseUnit;
  perishable?: boolean;
  surplusWarningAbove?: number;
  purchaseOptions: Array<{
    label: string;
    quantity: number;
    price: number;
  }>;
};

export type IngredientDemand = {
  productId: string;
  quantity: number;
  unit: BaseUnit;
  needOn: string;
  mealId: string;
};

export type InventoryLot = {
  id: string;
  productId: string;
  quantity: number;
  unit: BaseUnit;
  source: InventorySource;
  usableFrom?: string;
  useBy?: string;
};

export type ShoppingCalculation = {
  productId: string;
  productName: string;
  unit: BaseUnit;
  grossNeed: number;
  homeAvailable: number;
  alreadyPurchasedAvailable: number;
  fromHome: number;
  fromAlreadyPurchased: number;
  expiredOrUnavailable: number;
  netDeficit: number;
  purchaseQuantity: number;
  packageBreakdown: string[];
  expectedCost: number;
  projectedRemainder: number;
  mealIds: string[];
  warning?: string;
};

export type RecipeBatchDefinition = {
  id: string;
  yieldServings: number;
  ingredients: Array<{ productId: string; quantity: number; unit: BaseUnit }>;
};

export type CookEvent = { id: string; recipeId: string; cookOn: string; batches: number };
export type ServeEvent = { id: string; cookEventId: string; servings: number };

export const nextMonthRules = {
  forbiddenProducts: ["white_fish", "white_cabbage", "pearl_barley"],
  greenBeans: "mix_only",
  broccoli: "allowed",
  maxRiceSideMealsPerWeek: 1,
  weekendBakingLunchesPerMonth: { min: 1, max: 2 },
  dinnerCaloriesPerPerson: { min: 550, max: 750, mode: "guideline" },
} as const;

type MutableLot = InventoryLot & { remaining: number };

const isoDay = (value: string | undefined, fallback: string) => value ?? fallback;

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} должно быть положительным целым числом в базовой единице.`);
  }
}

export function buildDemandsFromPlan(input: {
  recipes: RecipeBatchDefinition[];
  cookEvents: CookEvent[];
  serveEvents: ServeEvent[];
}): IngredientDemand[] {
  const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const cooks = new Map(input.cookEvents.map((event) => [event.id, event]));
  if (recipes.size !== input.recipes.length) throw new Error("Идентификаторы рецептов должны быть уникальны.");
  if (cooks.size !== input.cookEvents.length) throw new Error("Идентификаторы готовок должны быть уникальны.");

  const servedByCook = new Map<string, number>();
  input.serveEvents.forEach((event) => {
    assertPositiveInteger(event.servings, `Порции подачи ${event.id}`);
    if (!cooks.has(event.cookEventId)) throw new Error(`Подача ${event.id} ссылается на неизвестную готовку.`);
    servedByCook.set(event.cookEventId, (servedByCook.get(event.cookEventId) ?? 0) + event.servings);
  });

  return input.cookEvents.flatMap((event) => {
    const recipe = recipes.get(event.recipeId);
    if (!recipe) throw new Error(`Готовка ${event.id} ссылается на неизвестный рецепт.`);
    assertPositiveInteger(event.batches, `Количество партий ${event.id}`);
    assertPositiveInteger(recipe.yieldServings, `Выход рецепта ${recipe.id}`);
    const cookedServings = recipe.yieldServings * event.batches;
    if ((servedByCook.get(event.id) ?? 0) > cookedServings) {
      throw new Error(`Из готовки ${event.id} подано больше порций, чем приготовлено.`);
    }
    return recipe.ingredients.map((ingredient) => {
      assertPositiveInteger(ingredient.quantity, `Ингредиент рецепта ${recipe.id}`);
      return {
        productId: ingredient.productId,
        quantity: ingredient.quantity * event.batches,
        unit: ingredient.unit,
        needOn: event.cookOn,
        mealId: event.id,
      };
    });
  });
}

function choosePurchase(
  deficit: number,
  options: ProductDefinition["purchaseOptions"],
): { quantity: number; cost: number; breakdown: string[] } {
  if (deficit <= 0) return { quantity: 0, cost: 0, breakdown: [] };
  if (options.length === 0) return { quantity: 0, cost: 0, breakdown: [] };

  options.forEach((option) => {
    assertPositiveInteger(option.quantity, `Фасовка «${option.label}»`);
    if (!Number.isFinite(option.price) || option.price < 0) {
      throw new Error(`Цена фасовки «${option.label}» должна быть неотрицательной.`);
    }
  });

  const maxPack = Math.max(...options.map((option) => option.quantity));
  const limit = deficit + maxPack - 1;
  const best: Array<{ cost: number; counts: number[] } | undefined> = Array(limit + 1);
  best[0] = { cost: 0, counts: options.map(() => 0) };

  for (let quantity = 0; quantity <= limit; quantity += 1) {
    const state = best[quantity];
    if (!state) continue;
    options.forEach((option, optionIndex) => {
      const nextQuantity = quantity + option.quantity;
      if (nextQuantity > limit) return;
      const nextCost = state.cost + option.price;
      const previous = best[nextQuantity];
      if (!previous || nextCost < previous.cost - 0.000_001) {
        const counts = [...state.counts];
        counts[optionIndex] += 1;
        best[nextQuantity] = { cost: nextCost, counts };
      }
    });
  }

  let winner: { quantity: number; cost: number; counts: number[] } | undefined;
  for (let quantity = deficit; quantity <= limit; quantity += 1) {
    const state = best[quantity];
    if (!state) continue;
    if (
      !winner
      || state.cost < winner.cost - 0.000_001
      || (Math.abs(state.cost - winner.cost) < 0.000_001 && quantity < winner.quantity)
    ) {
      winner = { quantity, cost: state.cost, counts: state.counts };
    }
  }

  if (!winner) return { quantity: 0, cost: 0, breakdown: [] };
  return {
    quantity: winner.quantity,
    cost: Number(winner.cost.toFixed(2)),
    breakdown: winner.counts.flatMap((count, index) => count > 0 ? [options[index].quantity === 1 ? options[index].label : `${options[index].label} × ${count}`] : []),
  };
}

export function calculateShopping(input: {
  products: ProductDefinition[];
  demands: IngredientDemand[];
  inventory: InventoryLot[];
}): ShoppingCalculation[] {
  const products = new Map(input.products.map((product) => [product.id, product]));
  if (products.size !== input.products.length) throw new Error("Идентификаторы продуктов должны быть уникальны.");
  const inventoryLotIds = new Set(input.inventory.map((lot) => lot.id));
  if (inventoryLotIds.size !== input.inventory.length) {
    throw new Error("Идентификаторы партий запаса должны быть уникальны.");
  }

  input.demands.forEach((demand) => {
    const product = products.get(demand.productId);
    if (!product) throw new Error(`Неизвестный продукт в потребности: ${demand.productId}.`);
    if (product.unit !== demand.unit) throw new Error(`Единица ${demand.productId} не совпадает с каталогом.`);
    assertPositiveInteger(demand.quantity, `Потребность ${demand.mealId}`);
  });
  input.inventory.forEach((lot) => {
    const product = products.get(lot.productId);
    if (!product) throw new Error(`Неизвестный продукт в остатке: ${lot.productId}.`);
    if (product.unit !== lot.unit) throw new Error(`Единица остатка ${lot.id} не совпадает с каталогом.`);
    assertPositiveInteger(lot.quantity, `Остаток ${lot.id}`);
  });

  return input.products
    .map((product): ShoppingCalculation | null => {
      const demands = input.demands
        .filter((item) => item.productId === product.id)
        .sort((a, b) => a.needOn.localeCompare(b.needOn));
      if (demands.length === 0) return null;

      const lots: MutableLot[] = input.inventory
        .filter((item) => item.productId === product.id)
        .map((item) => ({ ...item, remaining: item.quantity }))
        .sort((a, b) => isoDay(a.useBy, "9999-12-31").localeCompare(isoDay(b.useBy, "9999-12-31")));

      let fromHome = 0;
      let fromAlreadyPurchased = 0;
      let unfilled = 0;
      for (const demand of demands) {
        let remainingDemand = demand.quantity;
        for (const lot of lots) {
          const usableFrom = isoDay(lot.usableFrom, "0000-01-01");
          const useBy = isoDay(lot.useBy, "9999-12-31");
          if (lot.remaining <= 0 || usableFrom > demand.needOn || useBy < demand.needOn) continue;
          const allocation = Math.min(remainingDemand, lot.remaining);
          lot.remaining -= allocation;
          remainingDemand -= allocation;
          if (lot.source === "home") fromHome += allocation;
          else fromAlreadyPurchased += allocation;
          if (remainingDemand === 0) break;
        }
        unfilled += remainingDemand;
      }

      const lastNeedDate = demands.at(-1)?.needOn ?? "9999-12-31";
      const unusableLots = lots.filter((lot) => (
        isoDay(lot.usableFrom, "0000-01-01") > lastNeedDate
        || isoDay(lot.useBy, "9999-12-31") < lastNeedDate
      ));
      const expiredOrUnavailable = unusableLots.reduce((sum, lot) => sum + lot.remaining, 0);
      const purchase = choosePurchase(unfilled, product.purchaseOptions);
      const projectedRemainder = lots
        .filter((lot) => !unusableLots.includes(lot))
        .reduce((sum, lot) => sum + lot.remaining, 0) + purchase.quantity - unfilled;
      const warnings: string[] = [];
      if (unfilled > 0 && purchase.quantity === 0) warnings.push("Нет доступной фасовки или цены для покрытия дефицита.");
      if (product.perishable && projectedRemainder > (product.surplusWarningAbove ?? 0)) {
        warnings.push(`После плана останется ${projectedRemainder} ${product.unit} скоропортящегося продукта; нужен перенос, заморозка или замена блюда.`);
      }

      return {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        grossNeed: demands.reduce((sum, demand) => sum + demand.quantity, 0),
        homeAvailable: input.inventory.filter((lot) => lot.productId === product.id && lot.source === "home").reduce((sum, lot) => sum + lot.quantity, 0),
        alreadyPurchasedAvailable: input.inventory.filter((lot) => lot.productId === product.id && lot.source === "already_purchased").reduce((sum, lot) => sum + lot.quantity, 0),
        fromHome,
        fromAlreadyPurchased,
        expiredOrUnavailable,
        netDeficit: unfilled,
        purchaseQuantity: purchase.quantity,
        packageBreakdown: purchase.breakdown,
        expectedCost: purchase.cost,
        projectedRemainder,
        mealIds: [...new Set(demands.map((demand) => demand.mealId))],
        warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      };
    })
    .filter((row): row is ShoppingCalculation => row !== null);
}

export function calculatePlanShopping(input: {
  status: PlanStatus;
  products: ProductDefinition[];
  demands: IngredientDemand[];
  inventory: InventoryLot[];
}): ShoppingCalculation[] {
  if (input.status !== "draft") {
    throw new Error("Уже купленную или закрытую неделю нельзя полностью пересчитать; допустима только явная точечная замена.");
  }
  return calculateShopping(input);
}

export const nextMonthFormulaPreview = calculatePlanShopping({
  status: "draft",
  products: [
    { id: "cucumber", name: "Огурцы", unit: "g", perishable: true, purchaseOptions: [{ label: "на вес", quantity: 1, price: 0.31 }] },
    { id: "tomato", name: "Помидоры", unit: "g", perishable: true, purchaseOptions: [{ label: "на вес", quantity: 1, price: 0.3 }] },
    { id: "eggs", name: "Яйца", unit: "pcs", purchaseOptions: [{ label: "упаковка 10 шт.", quantity: 10, price: 93 }] },
    { id: "yogurt", name: "Йогурт", unit: "g", perishable: true, surplusWarningAbove: 100, purchaseOptions: [{ label: "стакан 250 г", quantity: 250, price: 85 }] },
  ],
  demands: [
    { productId: "cucumber", quantity: 300, unit: "g", needOn: "2026-09-02", mealId: "салат-1" },
    { productId: "cucumber", quantity: 200, unit: "g", needOn: "2026-09-04", mealId: "салат-2" },
    { productId: "cucumber", quantity: 400, unit: "g", needOn: "2026-09-06", mealId: "салат-3" },
    { productId: "tomato", quantity: 500, unit: "g", needOn: "2026-09-06", mealId: "салаты" },
    { productId: "eggs", quantity: 8, unit: "pcs", needOn: "2026-09-06", mealId: "завтраки" },
    { productId: "yogurt", quantity: 700, unit: "g", needOn: "2026-09-06", mealId: "соусы" },
  ],
  inventory: [
    { id: "cucumber-home", productId: "cucumber", quantity: 700, unit: "g", source: "home", useBy: "2026-09-07" },
    { id: "tomato-home", productId: "tomato", quantity: 700, unit: "g", source: "home", useBy: "2026-09-07" },
    { id: "eggs-home", productId: "eggs", quantity: 11, unit: "pcs", source: "home", useBy: "2026-09-21" },
    { id: "yogurt-bought", productId: "yogurt", quantity: 750, unit: "g", source: "already_purchased", useBy: "2026-09-09" },
  ],
});
