"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("maintain weight");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!sex || !height || !weight || !age) {
      setMessage("Please fill in all profile fields");
      return;
    }

    setLoading(true);
    setMessage(null);

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email: `${username}@app.local`, 
      password 
    });

    if (authError) {
      setLoading(false);
      setMessage(authError.message);
      return;
    }

    if (!authData.user) {
      setLoading(false);
      setMessage("Error creating account");
      return;
    }

    // Calculate caloric maintenance
    const heightCm = Number(height) * 2.54;
    const weightKg = Number(weight) * 0.453592;
    const ageNum = Number(age);
    
    let bmr = 0;
    if (sex === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161;
    }

    const multipliers: { [key: string]: number } = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      heavy: 1.725,
    };

    const caloricMaintenance = Math.round(bmr * (multipliers[activityLevel] || 1.55));

    // Save profile to database
    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: authData.user.id,
        sex,
        age: age ? Number(age) : null,
        height: Number(height),
        weight: Number(weight),
        caloric_maintenance: caloricMaintenance,
        activity_level: activityLevel,
        goal,
      });

    setLoading(false);

    if (profileError) {
      setMessage(`Account created but failed to save profile: ${profileError.message}`);
      return;
    }

    setMessage("Account created successfully! Redirecting...");
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        type="text"
        required
      />
      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        required
      />
      
      <div className="border-t border-zinc-300 dark:border-zinc-600 pt-3 mt-1">
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-3">Profile Information</p>
      </div>

      <select
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        value={sex}
        onChange={(e) => setSex(e.target.value)}
        required
      >
        <option value="">Select Sex</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>

      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Height (inches)"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        type="number"
        step="0.1"
        required
      />

      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Age (years)"
        value={age}
        onChange={(e) => setAge(e.target.value)}
        type="number"
        step="1"
        min="0"
        required
      />

      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Weight (pounds)"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        type="number"
        step="0.1"
        required
      />

      <select
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        value={activityLevel}
        onChange={(e) => setActivityLevel(e.target.value)}
      >
        <option value="sedentary">Sedentary (little or no exercise)</option>
        <option value="light">Light (exercise 1-3 days/week)</option>
        <option value="moderate">Moderate (exercise 3-5 days/week)</option>
        <option value="heavy">Heavy (exercise 6-7 days/week)</option>
      </select>

      <select
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      >
        <option value="lose weight">Lose Weight</option>
        <option value="gain muscle">Gain Muscle</option>
        <option value="body recomp">Body Recomposition</option>
        <option value="maintain weight">Maintain Weight</option>
      </select>

      <button
        className="rounded px-4 py-2 text-white"
        style={{ backgroundColor: "#cc0033" }}
        disabled={loading}
        type="submit"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
      {message && <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>}
    </form>
  );
}

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter()
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email: `${username}@app.local`, password });

    setLoading(false);
    setMessage(error ? error.message : "Logged in successfully.");
    
    if (!error) {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        type="text"
        required
      />
      <input
        className="rounded border px-3 py-2 dark:bg-zinc-700 dark:text-white dark:border-zinc-600"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        required
      />
      <button
        className="rounded px-4 py-2 text-white"
        style={{ backgroundColor: "#cc0033" }}
        disabled={loading}
        type="submit"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      {message && <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p>}
    </form>
  );
}
