"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import CampusMultiSelect from "../../components/CampusMultiSelect";
import DietPlan from "../../components/DietPlan";
import food from "../../food.json";
import { generatePlanFromProfile } from "../../lib/buildPlanFromProfile";

export default function DashboardPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([]);
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const userEmail = data.user.email?.replace("@app.local", "");
        setUsername(userEmail || null);

        // Fetch user profile from user_profiles table using user_id
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", data.user.id)
          .single();

        if (profileData) {
          setUserProfile(profileData);
        } else if (profileError) {
          console.error("Error fetching profile:", profileError);
        }
      }
    };
    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const userEmail = session.user.email?.replace("@app.local", "");
        setUsername(userEmail || null);

        // Fetch profile on auth state change
        const fetchProfile = async () => {
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          if (profileData) {
            setUserProfile(profileData);
          }
        };
        fetchProfile();
      } else {
        setUsername(null);
        setUserProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    setUsername(null);
    router.push("/");
  }

  async function generateDietPlan() {
    if (selectedCampuses.length === 0) {
      setError("Please select at least one location");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: ALGORITHM PLACEHOLDER
      // Replace this with the actual diet generation algorithm
      // The algorithm should:
      // 1. Take the selectedCampuses as input
      // 2. Use userProfile data for personalization (dietary restrictions, preferences, nutritional goals, etc.)
      // 3. Filter food items from food.json based on selected campuses
      // 4. Create a balanced meal plan for breakfast, lunch, and dinner
      // 5. Return a JSON object with structure: { breakfast: MealItem[], lunch: MealItem[], dinner: MealItem[] }

      // userProfile format: { id, email, dietary_restrictions, preferences, nutritional_goals, ... }
      // (all columns from the profiles table in Supabase)
      
      // Separate user profile and campus selection:
      const profileData = userProfile;
      const campusSelection: string[] = selectedCampuses;


      

      // Placeholder algorithm logic:
      const filteredFood = food.filter((item: any) =>
        campusSelection.includes(item.campus)
      );

      // TODO: Implement meal selection logic here
      // This should intelligently select meals for breakfast, lunch, and dinner
      // considering nutritional balance, variety, user preferences, and available options
/*
      const generatedPlan = {
        breakfast: [
          {
            name: "Sample Breakfast Item",
            nutrition: {
              calories: 350,
              protein_g: 10,
              carbs: 45,
              fat: 8,
            },
          },
        ],
        lunch: [
          {
            name: "Sample Lunch Item",
            nutrition: {
              calories: 550,
              protein_g: 25,
              carbs: 60,
              fat: 15,
            },
          },
        ],
        dinner: [
          {
            name: "Sample Dinner Item",
            nutrition: {
              calories: 450,
              protein_g: 20,
              carbs: 50,
              fat: 12,
            },
          },
        ],
      };
      */

      const generatedPlan = generatePlanFromProfile(profileData, campusSelection);

      // Save plan to Supabase
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user?.id) {
        const { error: dbError } = await supabase
          .from("plans")
          .upsert(
            {
              id: authData.user.id,
              plan: generatedPlan,
            },
            { onConflict: "id" }
          );

        if (dbError) {
          console.error("Error saving plan to database:", dbError);
          setError("Plan generated but failed to save. Please try again.");
          return;
        }
      }

      // TODO: Replace above with actual algorithm output
      setDietPlan(generatedPlan);
    } catch (err) {
      setError("Failed to generate diet plan. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Navbar username={username} onSignOut={signOut} />
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
        <div className="w-full max-w-2xl rounded bg-white/90 dark:bg-zinc-800/90 p-8 shadow">
          <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-white">
            Dashboard
          </h1>
          {username ? (
            <div>
              <div className="mb-6">
                <CampusMultiSelect
                  onCampusesChange={(campuses) =>
                    setSelectedCampuses(campuses)
                  }
                />
              </div>

              {selectedCampuses.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-700 rounded">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Showing food items for:{" "}
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {selectedCampuses.join(", ")}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={generateDietPlan}
                    disabled={isLoading}
                    className="w-full px-4 py-3 text-white font-semibold rounded transition opacity-90 hover:opacity-100 disabled:opacity-60"
                    style={{ backgroundColor: "#cc0033" }}
                  >
                    {isLoading
                      ? "Generating Your Diet Plan..."
                      : "Generate My Daily Diet Plan"}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-100 rounded">
                  {error}
                </div>
              )}

              {dietPlan && <DietPlan data={dietPlan} />}
            </div>
          ) : (
            <div>
              <p className="mb-4 text-zinc-900 dark:text-white">
                You are not signed in.
              </p>
              <p className="text-zinc-900 dark:text-white">
                <Link
                  href="/login"
                  className="font-semibold"
                  style={{ color: "#cc0033" }}
                >
                  Sign in
                </Link>{" "}
                or{" "}
                <Link
                  href="/register"
                  className="font-semibold"
                  style={{ color: "#cc0033" }}
                >
                  create an account
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
