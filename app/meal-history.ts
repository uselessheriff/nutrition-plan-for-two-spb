export type MealHistoryWeek = 1 | 2 | 3;

export type MealOutcome = "cooked" | "not_eaten" | "planned_to_skip" | "unconfirmed";

export type MealPreference = "favorite" | "liked" | "blocked" | null;

export type MealHistoryOrigin = "current_menu" | "history_only";

export type MealHistoryEvidence = {
  source: "user_report" | "current_menu" | "prior_menu";
  detail: string;
};

export type MealHistoryEntry = {
  id: string;
  week: MealHistoryWeek;
  menuKey: string | null;
  day: string;
  mealType: string;
  title: string;
  origin: MealHistoryOrigin;
  outcome: MealOutcome;
  preference: MealPreference;
  evidence: readonly MealHistoryEvidence[];
  note: string;
};

export type WeekMealHistorySummary = {
  week: MealHistoryWeek;
  currentMenuCount: number;
  historyOnlyCount: number;
  totalCount: number;
  outcomes: Readonly<Record<MealOutcome, number>>;
  preferences: Readonly<Record<Exclude<MealPreference, null> | "unrated", number>>;
};

type CurrentMenuMeal = Pick<MealHistoryEntry, "week" | "day" | "mealType" | "title">;

export const mealOutcomeLabels: Readonly<Record<MealOutcome, string>> = {
  cooked: "Готовили",
  not_eaten: "Не ели",
  planned_to_skip: "Планировали пропустить",
  unconfirmed: "Факт не подтверждён",
};

export const mealPreferenceLabels: Readonly<Record<Exclude<MealPreference, null>, string>> = {
  favorite: "Любимое",
  liked: "Понравилось",
  blocked: "Исключено",
};

export const createMealMenuKey = (week: MealHistoryWeek, title: string) => `${week}:${title}`;

const currentMenuMeals: readonly CurrentMenuMeal[] = [
  { week: 1, day: "Понедельник", mealType: "Ужин", title: "Филе с картофелем, огурцами и томатами" },
  { week: 1, day: "Вторник", mealType: "Ужин", title: "Паста с курицей и грибами" },
  { week: 1, day: "Среда", mealType: "Ужин", title: "Печень по-строгановски с гречкой" },
  { week: 1, day: "Четверг", mealType: "Ужин", title: "Голени с рисом и овощами" },
  { week: 1, day: "Пятница", mealType: "Ужин", title: "Пицца с курицей, грибами и томатами" },
  { week: 1, day: "Суббота", mealType: "Завтрак", title: "Творожно-овсяные панкейки" },
  { week: 1, day: "Суббота", mealType: "Обед", title: "Остатки пиццы + огурцы" },
  { week: 1, day: "Суббота", mealType: "Ужин", title: "Картофельно-творожная запеканка" },
  { week: 1, day: "Воскресенье", mealType: "Завтрак", title: "Омлет с сыром и огурцом" },
  { week: 1, day: "Воскресенье", mealType: "Обед", title: "Запечённая овсянка с бананом" },
  { week: 1, day: "Воскресенье", mealType: "Ужин", title: "Рис с яйцом, морковью и томатом" },

  { week: 2, day: "Понедельник", mealType: "Ужин", title: "Эскалопы с гречкой и салатом" },
  { week: 2, day: "Вторник", mealType: "Ужин", title: "Форель с рисом и брокколи" },
  { week: 2, day: "Среда", mealType: "Ужин", title: "Яичная лапша с курицей и овощами" },
  { week: 2, day: "Четверг", mealType: "Ужин", title: "Котлеты, картофель и салат из огурца и моркови" },
  { week: 2, day: "Пятница", mealType: "Ужин", title: "Фриттата с Фетаксой и овощами" },
  { week: 2, day: "Суббота", mealType: "Завтрак", title: "Манная каша с бананом" },
  { week: 2, day: "Суббота", mealType: "Обед", title: "Греческий салат с Фетаксой и питой" },
  { week: 2, day: "Суббота", mealType: "Ужин", title: "Куриные фахитас" },
  { week: 2, day: "Воскресенье", mealType: "Завтрак", title: "Овсяно-творожные панкейки с льном" },
  { week: 2, day: "Воскресенье", mealType: "Обед", title: "Фахитас из субботней заготовки" },
  { week: 2, day: "Воскресенье", mealType: "Ужин", title: "Курица с картофелем на одном противне" },

  { week: 3, day: "Понедельник", mealType: "Ужин", title: "Тёплый салат с кальмаром и кускусом" },
  { week: 3, day: "Вторник", mealType: "Ужин", title: "Курица с гречкой и овощами по-деревенски" },
  { week: 3, day: "Среда", mealType: "Ужин", title: "Спагетти болоньезе с говяжьим фаршем" },
  { week: 3, day: "Пятница", mealType: "Ужин", title: "Пангасиус с картофелем, фасолью и лимонным соусом" },
  { week: 3, day: "Суббота", mealType: "Завтрак", title: "Пшённая каша с яблоком, ягодами и корицей" },
  { week: 3, day: "Воскресенье", mealType: "Завтрак", title: "Сырники с ягодами и йогуртом" },
  { week: 3, day: "Воскресенье", mealType: "Ужин", title: "Куриный чили с фасолью, кукурузой и тортильями" },
];

const evidenceFromCurrentMenu: readonly MealHistoryEvidence[] = [{
  source: "current_menu",
  detail: "Блюдо есть в текущем архиве меню; само присутствие в меню не доказывает приготовление.",
}];

const verifiedByMenuKey: Readonly<Record<string, Pick<MealHistoryEntry, "outcome" | "preference" | "evidence" | "note">>> = {
  [createMealMenuKey(1, "Пицца с курицей, грибами и томатами")]: {
    outcome: "cooked",
    preference: "favorite",
    evidence: [{ source: "user_report", detail: "Пиццу приготовили; пользователь отдельно сообщил, что она очень понравилась." }],
    note: "Подтверждены и факт приготовления, и положительная оценка.",
  },
  [createMealMenuKey(1, "Творожно-овсяные панкейки")]: {
    outcome: "cooked",
    preference: null,
    evidence: [{ source: "user_report", detail: "Пользователь сообщил, что сделал двойную порцию овсяно-творожных панкейков." }],
    note: "Приготовление подтверждено; вкусовая оценка не зафиксирована.",
  },
  [createMealMenuKey(3, "Пангасиус с картофелем, фасолью и лимонным соусом")]: {
    outcome: "cooked",
    preference: "blocked",
    evidence: [{ source: "user_report", detail: "Рыбу приготовили большой порцией и доедали; позже пользователь попросил исключить белую рыбу из будущих блюд." }],
    note: "Приготовленное блюдо одновременно может быть исключено из будущей ротации.",
  },
  [createMealMenuKey(3, "Сырники с ягодами и йогуртом")]: {
    outcome: "unconfirmed",
    preference: "liked",
    evidence: [{ source: "user_report", detail: "Пользователь назвал сырники хорошим блюдом, но подтверждения приготовления именно в третью неделю нет." }],
    note: "Предпочтение подтверждено отдельно от факта приготовления.",
  },
};

const currentMenuEntries: readonly MealHistoryEntry[] = currentMenuMeals.map((meal) => {
  const menuKey = createMealMenuKey(meal.week, meal.title);
  const verified = verifiedByMenuKey[menuKey];

  return {
    id: `current:${menuKey}`,
    ...meal,
    menuKey,
    origin: "current_menu",
    outcome: verified?.outcome ?? "unconfirmed",
    preference: verified?.preference ?? null,
    evidence: verified?.evidence ?? evidenceFromCurrentMenu,
    note: verified?.note ?? "В переписке нет достаточного подтверждения, готовили ли это блюдо.",
  };
});

export const historyOnlyMealEntries: readonly MealHistoryEntry[] = [
  {
    id: "history:3:thursday-beef-cutlets",
    week: 3,
    menuKey: null,
    day: "Четверг",
    mealType: "Ужин",
    title: "Котлеты из говядины с булгуром и салатом из огурца, перца и моркови",
    origin: "history_only",
    outcome: "not_eaten",
    preference: null,
    evidence: [
      { source: "prior_menu", detail: "Блюдо находилось в прежней версии плана третьей недели." },
      { source: "user_report", detail: "Пользователь сообщил, что в четверг ужина не было." },
    ],
    note: "Убрано из текущего меню; факт отсутствия ужина подтверждён.",
  },
  {
    id: "history:3:saturday-greek-salad",
    week: 3,
    menuKey: null,
    day: "Суббота",
    mealType: "Обед",
    title: "Греческий салат с курицей и питой",
    origin: "history_only",
    outcome: "planned_to_skip",
    preference: null,
    evidence: [
      { source: "prior_menu", detail: "Блюдо находилось в прежней версии плана третьей недели." },
      { source: "user_report", detail: "До завершения недели пользователь сообщил, что в субботу не будет обедать." },
    ],
    note: "Это заявленное намерение, а не подтверждённый постфактум пропуск.",
  },
  {
    id: "history:3:saturday-turkey-casserole",
    week: 3,
    menuKey: null,
    day: "Суббота",
    mealType: "Ужин",
    title: "Картофельная запеканка с индейкой и овощами",
    origin: "history_only",
    outcome: "planned_to_skip",
    preference: null,
    evidence: [
      { source: "prior_menu", detail: "Блюдо находилось в прежней версии плана третьей недели." },
      { source: "user_report", detail: "До завершения недели пользователь сообщил, что в субботу не будет ужинать." },
    ],
    note: "Это заявленное намерение, а не подтверждённый постфактум пропуск.",
  },
  {
    id: "history:3:sunday-leftover-casserole",
    week: 3,
    menuKey: null,
    day: "Воскресенье",
    mealType: "Обед",
    title: "Остаток запеканки и свежий салат",
    origin: "history_only",
    outcome: "planned_to_skip",
    preference: null,
    evidence: [
      { source: "prior_menu", detail: "Блюдо находилось в прежней версии плана третьей недели." },
      { source: "user_report", detail: "До завершения недели пользователь сообщил, что в воскресенье не будет обедать." },
    ],
    note: "Это заявленное намерение, а не подтверждённый постфактум пропуск.",
  },
];

export const mealHistoryEntries: readonly MealHistoryEntry[] = [
  ...currentMenuEntries,
  ...historyOnlyMealEntries,
];

export const mealHistoryByMenuKey: Readonly<Record<string, MealHistoryEntry>> = Object.fromEntries(
  currentMenuEntries.map((entry) => [entry.menuKey, entry]),
);

export const getMealHistoryByMenuKey = (menuKey: string) => mealHistoryByMenuKey[menuKey];

export const getWeekMealHistory = (week: MealHistoryWeek) => mealHistoryEntries.filter((entry) => entry.week === week);

export const isConfirmedNotEaten = (entry: MealHistoryEntry) => entry.outcome === "not_eaten";

const summarizeWeek = (week: MealHistoryWeek): WeekMealHistorySummary => {
  const entries = getWeekMealHistory(week);
  const outcomeCount = (outcome: MealOutcome) => entries.filter((entry) => entry.outcome === outcome).length;
  const preferenceCount = (preference: Exclude<MealPreference, null>) => entries.filter((entry) => entry.preference === preference).length;

  return {
    week,
    currentMenuCount: entries.filter((entry) => entry.origin === "current_menu").length,
    historyOnlyCount: entries.filter((entry) => entry.origin === "history_only").length,
    totalCount: entries.length,
    outcomes: {
      cooked: outcomeCount("cooked"),
      not_eaten: outcomeCount("not_eaten"),
      planned_to_skip: outcomeCount("planned_to_skip"),
      unconfirmed: outcomeCount("unconfirmed"),
    },
    preferences: {
      favorite: preferenceCount("favorite"),
      liked: preferenceCount("liked"),
      blocked: preferenceCount("blocked"),
      unrated: entries.filter((entry) => entry.preference === null).length,
    },
  };
};

export const weekMealHistorySummaries: Readonly<Record<MealHistoryWeek, WeekMealHistorySummary>> = {
  1: summarizeWeek(1),
  2: summarizeWeek(2),
  3: summarizeWeek(3),
};

export const weekMealHistoryNotes: Readonly<Record<MealHistoryWeek, readonly string[]>> = {
  1: [
    "Подтверждены пицца и двойная порция творожно-овсяных панкейков; субботний завтрак перенесли на обед.",
    "Лисички испортились и были заменены другими грибами. Это факт замены ингредиента, но не доказательство приготовления каждого грибного блюда.",
    "Воскресные омлет и болоньезе, а также возможная отмена котлет были сформулированы как план — итог не подтверждён.",
  ],
  2: [
    "По конкретным блюдам нет прямого отчёта: покупки и остатки не считаются доказательством приготовления.",
    "Белокочанную капусту удалили из рецептов и заменили другими овощами; брокколи оставили. Это редакция рецептов, а не факт готовки.",
  ],
  3: [
    "Подтверждены большая приготовленная порция рыбы и отсутствие ужина в четверг; белая рыба исключена только из будущей ротации.",
    "Пропуски субботнего обеда и ужина и воскресного обеда были заявлены заранее, поэтому отмечены как планируемые, а не подтверждённые.",
    "Сырники и куриный чили были планом на воскресенье. Сырники нравятся, но приготовление именно в эту неделю не подтверждено.",
  ],
};
