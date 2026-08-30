import { nextMonthFormulaPreview, type BaseUnit, type ShoppingCalculation } from "./shopping-planner";

export type PurchaseDecisionStatus = "to_buy" | "already_purchased" | "removed_home_stock" | "missing_price" | "check_home" | "unknown_purchase";

export type PurchaseDecision = {
  id: string;
  productName: string;
  status: PurchaseDecisionStatus;
  statusLabel: string;
  reason: string;
  unit?: BaseUnit;
  grossNeed?: number;
  homeAvailable?: number;
  alreadyPurchasedAvailable?: number;
  netDeficit?: number;
  purchaseQuantity?: number;
  packageBreakdown?: string[];
  expectedCost: number | null;
};

export type ManualPurchaseDecision = {
  id: string;
  productName: string;
  status: "missing_price" | "check_home" | "unknown_purchase";
  reason: string;
  expectedCost?: number | null;
};

export const purchaseDecisionLabels: Record<PurchaseDecisionStatus, string> = {
  to_buy: "Нужно купить",
  already_purchased: "Уже куплено",
  removed_home_stock: "Убрано из закупки",
  missing_price: "Нет данных о цене",
  check_home: "Проверить дома",
  unknown_purchase: "Нет данных о закупке",
};

const purchaseUnitLabels: Record<BaseUnit, string> = {
  g: "г",
  ml: "мл",
  pcs: "шт",
};

function classifyCalculation(row: ShoppingCalculation): PurchaseDecision {
  let status: PurchaseDecisionStatus;
  let reason: string;
  let expectedCost: number | null = row.expectedCost;
  const unitLabel = purchaseUnitLabels[row.unit];

  if (row.netDeficit > 0 && (row.purchaseQuantity === 0 || row.expectedCost <= 0)) {
    status = "missing_price";
    reason = `Дефицит ${row.netDeficit} ${unitLabel} подтверждён, но цена или подходящая фасовка ещё не внесена.`;
    expectedCost = null;
  } else if (row.netDeficit > 0 && row.purchaseQuantity > 0) {
    status = "to_buy";
    reason = `После вычета дома и уже купленного не хватает ${row.netDeficit} ${unitLabel}; купить ${row.purchaseQuantity} ${unitLabel}.`;
  } else if (row.fromAlreadyPurchased > 0 && row.netDeficit === 0) {
    status = "already_purchased";
    reason = `Потребность закрыта уже купленной партией: повторно добавлять ${row.productName.toLowerCase()} нельзя.`;
  } else {
    status = "removed_home_stock";
    reason = `Потребность закрыта пригодным домашним остатком; после плана останется ${row.projectedRemainder} ${unitLabel}.`;
  }

  return {
    id: row.productId,
    productName: row.productName,
    status,
    statusLabel: purchaseDecisionLabels[status],
    reason,
    unit: row.unit,
    grossNeed: row.grossNeed,
    homeAvailable: row.homeAvailable,
    alreadyPurchasedAvailable: row.alreadyPurchasedAvailable,
    netDeficit: row.netDeficit,
    purchaseQuantity: row.purchaseQuantity,
    packageBreakdown: row.packageBreakdown,
    expectedCost,
  };
}

export function buildPurchaseDecisions(
  calculations: ShoppingCalculation[],
  manual: ManualPurchaseDecision[] = [],
): PurchaseDecision[] {
  const ids = [...calculations.map((row) => row.productId), ...manual.map((row) => row.id)];
  if (new Set(ids).size !== ids.length) throw new Error("Идентификаторы решений по закупке должны быть уникальны.");

  const automatic = calculations.map(classifyCalculation);
  const unresolved = manual.map((row): PurchaseDecision => ({
    id: row.id,
    productName: row.productName,
    status: row.status,
    statusLabel: purchaseDecisionLabels[row.status],
    reason: row.reason,
    expectedCost: row.expectedCost ?? null,
  }));
  return [...automatic, ...unresolved];
}

export const nextMonthPurchaseDecisionPreview = buildPurchaseDecisions(nextMonthFormulaPreview, [
  {
    id: "staples-check",
    productName: "Масло, горчица и лимонный сок",
    status: "check_home",
    reason: "Не считать покупкой автоматически: сначала получить фактический остаток дома.",
  },
  {
    id: "unreported-item",
    productName: "Позиция без сообщения или чека",
    status: "unknown_purchase",
    reason: "Пока пользователь не сообщил покупку, она не считается ни купленной, ни потраченной.",
  },
]);
