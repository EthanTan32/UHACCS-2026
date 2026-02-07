"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useRouter } from "next/navigation";

interface UserProfile {
  sex: string;
  age: number | "";
  height: number | "";
  weight: number | "";
  caloric_maintenance: number | "";
  activity_level: string;
  goal: string;
}

export default function ProfilePage() {
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    sex: "",
    age: "",
    height: "",
    weight: "",
    caloric_maintenance: "",
    activity_level: "moderate",
    goal: "maintain weight",
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data } = await supabase.auth.getUser();
      
      if (!data.user) {
        router.push("/login");
        return;
      }

      if (data.user?.email) {
        setUsername(data.user.email.replace("@app.local", ""));
      }

      // Load profile from database
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      setLoading(false);
    };

    loadUserProfile();
  }, [router]);

  const calculateCalories = (height: number, weight: number, sex: string, age: number, activityLevel: string) => {
    if (!height || !weight || !age) return "";

    // Convert inches to cm and pounds to kg
    const heightCm = height * 2.54;
    const weightKg = weight * 0.453592;

    // Mifflin-St Jeor formula for BMR using provided age
    let bmr = 0;
    if (sex === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }

    // Activity multipliers
    const multipliers: { [key: string]: number } = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      heavy: 1.725,
    };

    const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.55));
    return tdee;
  };

  const handleInputChange = (field: string, value: string | number) => {
    const updatedProfile = { ...profile, [field]: value };
    setProfile(updatedProfile);

    // Auto-calculate calories when height, weight, sex, age, or activity level changes
    if (["height", "weight", "sex", "age", "activity_level"].includes(field)) {
      const calories = calculateCalories(
        Number(updatedProfile.height),
        Number(updatedProfile.weight),
        updatedProfile.sex,
        Number(updatedProfile.age),
        updatedProfile.activity_level
      );
      updatedProfile.caloric_maintenance = calories ? Number(calories) : "";
      setProfile(updatedProfile);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      
      if (!data.user) {
        console.error("No user found");
        return;
      }

      const profileData = {
        user_id: data.user.id,
        sex: profile.sex || null,
        age: profile.age ? Number(profile.age) : null,
        height: profile.height ? Number(profile.height) : null,
        weight: profile.weight ? Number(profile.weight) : null,
        caloric_maintenance: profile.caloric_maintenance ? Number(profile.caloric_maintenance) : null,
        activity_level: profile.activity_level || null,
        goal: profile.goal || null,
      };

      console.log("Saving profile data:", profileData);

      const { data: result, error } = await supabase
        .from("user_profiles")
        .upsert(profileData);

      if (error) {
        console.error("Error saving profile:", error.message, error);
        alert(`Error saving profile: ${error.message}`);
      } else {
        console.log("Profile saved successfully");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred");
    }
  };

  async function signOut() {
    await supabase.auth.signOut();
    setUsername(null);
    router.push("/login");
  }

  if (loading) {
    return (
      <>
        <Navbar username={username} onSignOut={signOut} />
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
          <div className="text-zinc-900 dark:text-white">Loading...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar username={username} onSignOut={signOut} />
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
        <div className="w-full max-w-2xl rounded bg-white/90 dark:bg-zinc-800/90 p-8 shadow">
          <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-white">
            Your Profile
          </h1>

          <div className="space-y-4">
            {/* Sex */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Sex
              </label>
              <select
                value={profile.sex}
                onChange={(e) => handleInputChange("sex", e.target.value)}
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="">Select Sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Height (inches)
              </label>
              <input
                type="number"
                value={profile.height}
                onChange={(e) => handleInputChange("height", e.target.value)}
                placeholder="Enter height in inches"
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Age (years)
              </label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => handleInputChange("age", e.target.value)}
                placeholder="Enter age in years"
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Weight (pounds)
              </label>
              <input
                type="number"
                value={profile.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                placeholder="Enter weight in pounds"
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>

            {/* Physical Activity Level */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Physical Activity Level
              </label>
              <select
                value={profile.activity_level}
                onChange={(e) => handleInputChange("activity_level", e.target.value)}
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="sedentary">Sedentary (little or no exercise)</option>
                <option value="light">Light (exercise 1-3 days/week)</option>
                <option value="moderate">Moderate (exercise 3-5 days/week)</option>
                <option value="heavy">Heavy (exercise 6-7 days/week)</option>
              </select>
            </div>

            {/* Caloric Maintenance */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Daily Caloric Maintenance (auto-calculated)
              </label>
              <input
                type="number"
                value={profile.caloric_maintenance}
                readOnly
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-600 text-zinc-900 dark:text-white cursor-not-allowed"
              />
              {profile.caloric_maintenance && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  Estimated daily calories to maintain current weight
                </p>
              )}
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                Goal
              </label>
              <select
                value={profile.goal}
                onChange={(e) => handleInputChange("goal", e.target.value)}
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="lose weight">Lose Weight</option>
                <option value="gain muscle">Gain Muscle</option>
                <option value="body recomp">Body Recomposition</option>
                <option value="maintain weight">Maintain Weight</option>
              </select>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveProfile}
            className="mt-6 w-full rounded px-4 py-2 text-white font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "#cc0033" }}
          >
            Save Profile
          </button>

          {saved && (
            <div className="mt-4 p-4 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              Profile saved successfully!
            </div>
          )}
        </div>
      </main>
    </>
  );
}
