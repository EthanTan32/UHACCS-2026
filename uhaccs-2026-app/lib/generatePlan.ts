// lib/generatePlan.ts
import foods from "../food.json";

export type Location = "livingston" | "atrium" | "any";
type Meal = "Breakfast" | "Lunch" | "Dinner";

type Nutrition = {
  calories: number;
  protein_g: number;
  carbs: number; // mapped from totalCarb_g
  fat: number; // mapped from totalFat_g
};

type FoodItem = {
  campus?: string;
  meal?: Meal | string;
  foodname?: string;
  portionSize?: string;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    totalCarb_g?: number;
    totalFat_g?: number;
  };
};

type PlanItem = {
  name: string;
  nutrition: Nutrition;
};

export type GeneratedPlan = {
  breakfast: PlanItem[];
  lunch: PlanItem[];
  dinner: PlanItem[];
};

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Combo = {
  items: PlanItem[];
  totals: Nutrition;
  score: number;
  campus: "livingston" | "atrium";
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function normalizeCampus(campusRaw: string | undefined): "livingston" | "atrium" | null {
  const c = (campusRaw || "").toLowerCase().trim();
  if (c === "livingston") return "livingston";
  if (c === "atrium") return "atrium";
  return null;
}

function normalizeMeal(mealRaw: string | undefined): Meal | null {
  const m = (mealRaw || "").toLowerCase().trim();
  if (m === "breakfast") return "Breakfast";
  if (m === "lunch") return "Lunch";
  if (m === "dinner") return "Dinner";
  return null;
}

function normalizeFood(item: FoodItem): PlanItem | null {
  const name = item.foodname?.trim();
  const n = item.nutrition;

  if (!name || !n) return null;

  const calories = n.calories ?? NaN;
  const protein_g = n.protein_g ?? NaN;
  const carbs = n.totalCarb_g ?? NaN;
  const fat = n.totalFat_g ?? NaN;

  if (![calories, protein_g, carbs, fat].every(Number.isFinite)) return null;

  return {
    name,
    nutrition: { calories, protein_g, carbs, fat },
  };
}

function addNut(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories + b.calories,
    protein_g: a.protein_g + b.protein_g,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/** Weighted L1 distance to targets. Lower is better. */
function macroDistance(total: Nutrition, goals: Goals): number {
  const wCal = 1.0;
  const wP = 4.0;
  const wC = 1.5;
  const wF = 1.5;

  return (
    wCal * Math.abs(total.calories - goals.calories) +
    wP * Math.abs(total.protein_g - goals.protein) +
    wC * Math.abs(total.carbs - goals.carbs) +
    wF * Math.abs(total.fat - goals.fat)
  );
}

/** Penalize meal calorie imbalance. Avoids 100/100/1800 kinds of solutions. */
function imbalancePenalty(b: number, l: number, d: number, totalGoal: number): number {
  const sum = b + l + d;
  if (sum <= 0) return 1e9;

  // Preferred ranges as fractions of total calories (tweakable)
  const fb = b / sum;
  const fl = l / sum;
  const fd = d / sum;

  const penFrac =
    Math.abs(fb - clamp(fb, 0.20, 0.35)) * 800 +
    Math.abs(fl - clamp(fl, 0.30, 0.45)) * 800 +
    Math.abs(fd - clamp(fd, 0.25, 0.45)) * 800;

  // Minimum meal calories
  const penMin =
    (b < 250 ? (250 - b) * 2 : 0) +
    (l < 400 ? (400 - l) * 2 : 0) +
    (d < 400 ? (400 - d) * 2 : 0);

  // Mild penalty for drifting from total goal (distance already handles it too)
  const penTotal = Math.abs(sum - totalGoal) * 0.15;

  return penFrac + penMin + penTotal;
}

/**
 * Build good meal-combos via beam search.
 * IMPORTANT: all items passed into this function should already be from ONE campus,
 * so the returned combo is automatically "single-campus within that meal".
 */
function buildMealCombos(
  mealFoods: PlanItem[],
  mealGoal: Nutrition,
  campus: "livingston" | "atrium",
  maxItems = 3,
  beamWidth = 250
): Combo[] {
  let beam: Combo[] = [
    {
      items: [],
      totals: { calories: 0, protein_g: 0, carbs: 0, fat: 0 },
      score: 0,
      campus,
    },
  ];

  for (let step = 0; step < maxItems; step++) {
    const next: Combo[] = [];

    for (const c of beam) {
      for (const f of mealFoods) {
        if (c.items.some((it) => it.name === f.name)) continue;

        const totals = addNut(c.totals, f.nutrition);

        const score = macroDistance(totals, {
          calories: mealGoal.calories,
          protein: mealGoal.protein_g,
          carbs: mealGoal.carbs,
          fat: mealGoal.fat,
        });

        next.push({ items: [...c.items, f], totals, score, campus });
      }
    }

    next.sort((a, b) => a.score - b.score);
    beam = next.slice(0, beamWidth);
  }

  return beam.filter((c) => c.items.length >= 1);
}

export function generatePlan(
  location: Location,
  caloriesGoal: number,
  proteinGoal: number,
  carbsGoal: number,
  fatGoal: number
): GeneratedPlan {
  const allFoods = foods as unknown as FoodItem[];

  // Normalize + keep only valid items with meal + campus + nutrition
  const normalized = allFoods
    .map((raw) => {
      const campus = normalizeCampus(raw.campus);
      const meal = normalizeMeal(raw.meal as string | undefined);
      const norm = normalizeFood(raw);
      return { raw, campus, meal, norm };
    })
    .filter((x) => x.campus !== null && x.meal !== null && x.norm !== null) as Array<{
    campus: "livingston" | "atrium";
    meal: Meal;
    norm: PlanItem;
  }>;

  // Goal split across meals (tweakable)
  const bGoal: Nutrition = {
    calories: caloriesGoal * 0.28,
    protein_g: proteinGoal * 0.25,
    carbs: carbsGoal * 0.30,
    fat: fatGoal * 0.28,
  };
  const lGoal: Nutrition = {
    calories: caloriesGoal * 0.38,
    protein_g: proteinGoal * 0.40,
    carbs: carbsGoal * 0.35,
    fat: fatGoal * 0.36,
  };
  const dGoal: Nutrition = {
    calories: caloriesGoal * 0.34,
    protein_g: proteinGoal * 0.35,
    carbs: carbsGoal * 0.35,
    fat: fatGoal * 0.36,
  };

  // Helper: get foods for a given meal and campus
  const foodsFor = (meal: Meal, campus: "livingston" | "atrium") =>
    normalized.filter((x) => x.meal === meal && x.campus === campus).map((x) => x.norm);

  // Which campuses are allowed?
  const allowedCampuses: Array<"livingston" | "atrium"> =
    location === "any" ? ["livingston", "atrium"] : [location];

  // Build combos PER (meal, campus) so each meal is internally single-campus.
  const combosBy = {
    Breakfast: [] as Combo[],
    Lunch: [] as Combo[],
    Dinner: [] as Combo[],
  };

  for (const campus of allowedCampuses) {
    const bFoods = foodsFor("Breakfast", campus);
    const lFoods = foodsFor("Lunch", campus);
    const dFoods = foodsFor("Dinner", campus);

    if (bFoods.length) combosBy.Breakfast.push(...buildMealCombos(bFoods, bGoal, campus, 3, 250));
    if (lFoods.length) combosBy.Lunch.push(...buildMealCombos(lFoods, lGoal, campus, 3, 250));
    if (dFoods.length) combosBy.Dinner.push(...buildMealCombos(dFoods, dGoal, campus, 3, 250));
  }

  // If any meal has zero options, bail safely
  if (!combosBy.Breakfast.length || !combosBy.Lunch.length || !combosBy.Dinner.length) {
    return { breakfast: [], lunch: [], dinner: [] };
  }

  // Keep top N per meal to make the cross product manageable
  combosBy.Breakfast.sort((a, b) => a.score - b.score);
  combosBy.Lunch.sort((a, b) => a.score - b.score);
  combosBy.Dinner.sort((a, b) => a.score - b.score);

  const bCombos = combosBy.Breakfast.slice(0, 120);
  const lCombos = combosBy.Lunch.slice(0, 120);
  const dCombos = combosBy.Dinner.slice(0, 120);

  // Combine meals: global objective + balance penalty
  const goals: Goals = { calories: caloriesGoal, protein: proteinGoal, carbs: carbsGoal, fat: fatGoal };

  let best:
    | {
        b: Combo;
        l: Combo;
        d: Combo;
        score: number;
      }
    | null = null;

  for (const b of bCombos) {
    for (const l of lCombos) {
      for (const d of dCombos) {
        const total = addNut(addNut(b.totals, l.totals), d.totals);

        const dist = macroDistance(total, goals);
        const bal = imbalancePenalty(b.totals.calories, l.totals.calories, d.totals.calories, caloriesGoal);

        // Optional tiny penalty for switching campuses between meals (set to 0 if you don't care)
        const switchPenalty =
          location === "any"
            ? (b.campus !== l.campus ? 20 : 0) + (l.campus !== d.campus ? 20 : 0)
            : 0;

        const score = dist + bal + switchPenalty;

        if (!best || score < best.score) best = { b, l, d, score };
      }
    }
  }

  const chosen = best ?? { b: bCombos[0], l: lCombos[0], d: dCombos[0], score: 0 };

  return {
    breakfast: chosen.b.items,
    lunch: chosen.l.items,
    dinner: chosen.d.items,
  };
}
