"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import DietPlan from "../../components/DietPlan";

export default function MyPlanPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        // Get current user
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          setError("You must be signed in to view your plan.");
          setIsLoading(false);
          return;
        }

        const userEmail = authData.user.email?.replace("@app.local", "");
        setUsername(userEmail || null);

        // Fetch plan from Supabase
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("plan")
          .eq("id", authData.user.id)
          .single();

        if (planError || !planData) {
          setDietPlan(null);
        } else if (planData && planData.plan) {
          setDietPlan(planData.plan);
        }
      } catch (err) {
        console.error("Error loading plan:", err);
        setError("Failed to load your plan.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();

    // Set up auth listener
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const userEmail = session.user.email?.replace("@app.local", "");
        setUsername(userEmail || null);
      } else {
        setUsername(null);
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

  if (isLoading) {
    return (
      <>
        <Navbar username={username} onSignOut={signOut} />
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
          <div className="w-full max-w-2xl rounded bg-white/90 dark:bg-zinc-800/90 p-8 shadow">
            <p className="text-zinc-900 dark:text-white">Loading your plan...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar username={username} onSignOut={signOut} />
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
        <div className="w-full max-w-2xl rounded bg-white/90 dark:bg-zinc-800/90 p-8 shadow">
          <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-white">
            My Plan
          </h1>

          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-100 rounded">
              {error}
            </div>
          )}

          {!dietPlan && !error ? (
            <div className="mt-6 text-center">
              <p className="mb-6 text-zinc-600 dark:text-zinc-300">
                You don't have a diet plan yet. Create one by going to the dashboard!
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 text-white font-semibold rounded transition opacity-90 hover:opacity-100"
                style={{ backgroundColor: "#cc0033" }}
              >
                Go to Dashboard
              </Link>
            </div>
          ) : dietPlan ? (
            <DietPlan data={dietPlan} />
          ) : null}
        </div>
      </main>
    </>
  );
}
