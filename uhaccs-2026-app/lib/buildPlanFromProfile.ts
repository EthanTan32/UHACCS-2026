import { generatePlan, type Location } from "@/lib/generatePlan";

type Sex = "male" | "female";

type ActivityLevel =
  | "Sedentary (little or no exercise"
  | "Light (exercise 1-3 days/week"
  | "Moderate (exercise 3-5 days/week)"
  | "Heavy (exercise 6-7 days/week)";

type Goal = "Lose Weight" | "Gain Muscle" | "Body Recomposition" | "Maintain Weight";

type ProfileData = {
  dietary_restrictions?: string[];
  nutritionalGoals?: Goal;
  sex: Sex;
  age: number; // years
  activity_level: ActivityLevel;
  height: number; // inches
  weight: number; // pounds
};

const round1 = (x: number) => Math.round(x * 10) / 10;
const round0 = (x: number) => Math.round(x);

function activityIndex(level: ActivityLevel): 0 | 1 | 2 | 3 {
  if (level.startsWith("Sedentary")) return 0;
  if (level.startsWith("Light")) return 1;
  if (level.startsWith("Moderate")) return 2;
  return 3;
}

function tdeeMultiplier(level: ActivityLevel): number {
  const idx = activityIndex(level);
  return [1.2, 1.375, 1.55, 1.725][idx];
}

function calorieGoalMultiplier(goal: Goal, level: ActivityLevel): number {
  const idx = activityIndex(level);
  const lose = [0.77, 0.825, 0.85, 0.875];
  const gain = [1.0, 1.075, 1.125, 1.15];
  const recomp = [0.95, 0.95, 0.975, 1.0];
  const maintain = [1.0, 1.0, 1.0, 1.0];

  if (goal === "Lose Weight") return lose[idx];
  if (goal === "Gain Muscle") return gain[idx];
  if (goal === "Body Recomposition") return recomp[idx];
  return maintain[idx];
}

function pickMultiplierFromTable(
  sex: Sex,
  goal: Goal,
  level: ActivityLevel,
  table: Record<Sex, Record<Goal, number[]>>
): number {
  const idx = activityIndex(level);
  return table[sex][goal][idx];
}

const proteinTable: Record<Sex, Record<Goal, number[]>> = {
  male: {
    "Lose Weight": [0.8, 0.85, 0.9, 0.975],
    "Gain Muscle": [0.6, 0.75, 0.85, 0.95],
    "Body Recomposition": [0.9, 0.95, 1.0, 1.075],
    "Maintain Weight": [0.6, 0.65, 0.7, 0.77],
  },
  female: {
    "Lose Weight": [0.7, 0.75, 0.8, 0.875],
    "Gain Muscle": [0.5, 0.7, 0.8, 0.9],
    "Body Recomposition": [0.8, 0.85, 0.9, 0.975],
    "Maintain Weight": [0.5, 0.575, 0.6, 0.675],
  },
};

const carbsTable: Record<Sex, Record<Goal, number[]>> = {
  male: {
    "Lose Weight": [0.6, 0.85, 1.15, 1.45],
    "Gain Muscle": [1.1, 1.75, 2.25, 2.75],
    "Body Recomposition": [0.8, 1.1, 1.35, 1.65],
    "Maintain Weight": [1.1, 1.3, 1.55, 1.75],
  },
  female: {
    "Lose Weight": [0.5, 0.7, 0.95, 1.25],
    "Gain Muscle": [1.0, 1.4, 1.85, 2.35],
    "Body Recomposition": [0.7, 0.9, 1.15, 1.45], // using 4 activity levels
    "Maintain Weight": [1.0, 1.1, 1.35, 1.55],
  },
};

const fatTable: Record<Sex, Record<Goal, number[]>> = {
  male: {
    "Lose Weight": [0.6, 0.85, 1.15, 1.45],
    "Gain Muscle": [1.1, 1.75, 2.25, 2.75],
    "Body Recomposition": [0.8, 1.1, 1.35, 1.65],
    "Maintain Weight": [0.425, 0.4, 0.375, 0.35],
  },
  female: {
    "Lose Weight": [0.5, 0.7, 0.95, 1.25],
    "Gain Muscle": [1.0, 1.4, 1.85, 2.35],
    "Body Recomposition": [0.7, 0.9, 1.15, 1.45],
    "Maintain Weight": [0.425, 0.4, 0.375, 0.35],
  },
};

// campusSelection is string[] now
function resolveLocation(campusSelection: string[]): Location {
  const normalized = new Set(
    (campusSelection ?? [])
      .map((s) => (s ?? "").toLowerCase().trim())
      .filter(Boolean)
  );

  const hasLivi = normalized.has("livingston");
  const hasAtrium = normalized.has("atrium");

  if (hasLivi && !hasAtrium) return "livingston";
  if (hasAtrium && !hasLivi) return "atrium";
  return "any"; // empty, both, or unknown -> any
}

export function generatePlanFromProfile(profileData: ProfileData, campusSelection: string[]) {
  const goal: Goal = profileData.nutritionalGoals ?? "Maintain Weight";
  const sex: Sex = profileData.sex;
  const activity = profileData.activity_level;

  // Unit conversions using your constants
  const heightCm = profileData.height * 2.2;
  const weightKg = profileData.weight * 0.45;
  const age = profileData.age;

  // BMR
  const sexConst = sex === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConst;

  // TDEE
  const tdee = bmr * tdeeMultiplier(activity);

  // Calorie goal
  const calorieGoal = tdee * calorieGoalMultiplier(goal, activity);

  // "LBM" proxy (as you specified)
  const lbmKg = sex === "male" ? weightKg * 0.8 : weightKg * 0.75;

  // Macro multipliers
  const proteinMult = pickMultiplierFromTable(sex, goal, activity, proteinTable);
  const carbsMult = pickMultiplierFromTable(sex, goal, activity, carbsTable);
  const fatMult = pickMultiplierFromTable(sex, goal, activity, fatTable);

  // Macro goals (grams)
  const proteinGoalG = proteinMult * lbmKg;
  const carbsGoalG = carbsMult * lbmKg;
  const fatGoalG = fatMult * lbmKg;

  // Location from string[]
  const location = resolveLocation(campusSelection);

  // Call your existing planner
  const generatedPlan = generatePlan(
    location,
    round0(calorieGoal),
    round0(proteinGoalG),
    round0(carbsGoalG),
    round0(fatGoalG)
  );

  // Return exactly what you asked: “just return whatever it returns”
  // If you want meta numbers for debugging, uncomment below.
  return generatedPlan;

  // return {
  //   generatedPlan,
  //   meta: {
  //     heightCm: round1(heightCm),
  //     weightKg: round1(weightKg),
  //     lbmKg: round1(lbmKg),
  //     bmr: round0(bmr),
  //     tdee: round0(tdee),
  //     calorieGoal: round0(calorieGoal),
  //     proteinGoalG: round0(proteinGoalG),
  //     carbsGoalG: round0(carbsGoalG),
  //     fatGoalG: round0(fatGoalG),
  //     location,
  //     goal,
  //     activity,
  //     sex,
  //   },
  // };
}
