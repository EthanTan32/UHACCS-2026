"use client";

interface MealItem {
  name: string;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs?: number;
    fat?: number;
  };
}

interface DietPlanData {
  breakfast: MealItem[];
  lunch: MealItem[];
  dinner: MealItem[];
}

interface DietPlanProps {
  data: DietPlanData;
}

export default function DietPlan({ data }: DietPlanProps) {
  const renderMealSection = (title: string, meals: MealItem[]) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        {meals.map((meal, idx) => (
          <div
            key={idx}
            className="p-4 bg-zinc-50 dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600"
          >
            <p className="font-medium text-zinc-900 dark:text-white mb-2">
              {meal.name}
            </p>
            {meal.nutrition && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                {meal.nutrition.calories && (
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Calories:</span>{" "}
                    {meal.nutrition.calories}
                  </div>
                )}
                {meal.nutrition.protein_g && (
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Protein:</span>{" "}
                    {meal.nutrition.protein_g}g
                  </div>
                )}
                {meal.nutrition.carbs && (
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Carbs:</span>{" "}
                    {meal.nutrition.carbs}g
                  </div>
                )}
                {meal.nutrition.fat && (
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">Fat:</span>{" "}
                    {meal.nutrition.fat}g
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mt-8 p-6 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
        Your Daily Diet Plan
      </h2>

      {renderMealSection("🌅 Breakfast", data.breakfast)}
      {renderMealSection("🍽️ Lunch", data.lunch)}
      {renderMealSection("🌙 Dinner", data.dinner)}

      <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Generated on {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
