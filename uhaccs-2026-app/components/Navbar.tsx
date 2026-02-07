"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

interface NavbarProps {
  username?: string | null;
  onSignOut?: () => void;
}

export default function Navbar({ username, onSignOut }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localUsername, setLocalUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data?.user?.email) {
        setLocalUsername(data.user.email.replace("@app.local", ""));
      } else {
        setLocalUsername(null);
      }
    };

    fetchUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user?.email) {
        setLocalUsername(session.user.email.replace("@app.local", ""));
      } else {
        setLocalUsername(null);
      }
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, []);

  const displayedUsername = username ?? localUsername;

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }

    await supabase.auth.signOut();
    setLocalUsername(null);
    router.push("/");
  };

  return (
    <nav className="bg-white dark:bg-zinc-800 shadow-md">
      <div className="max-w-full px-8 py-4 flex justify-between items-center">
        {/* Left side - App name and navigation links */}
        <div className="flex gap-8 items-center">
          <Link href="/dashboard" className="text-xl font-bold" style={{ color: "#cc0033" }}>
            Scarlet Eats
          </Link>
          <Link href="/dashboard" className="text-zinc-900 dark:text-white font-semibold hover:text-red-500 dark:hover:text-red-400 transition">
            Dashboard
          </Link>
          <Link href="/my-plan" className="text-zinc-900 dark:text-white font-semibold hover:text-red-500 dark:hover:text-red-400 transition">
            My Plan
          </Link>
          <Link href="/chat" className="text-zinc-900 dark:text-white font-semibold hover:text-red-500 dark:hover:text-red-400 transition">
            Diet Coach
          </Link>
        </div>

        {/* Right side - User dropdown (always reserves space to avoid layout shift) */}
        <div className="flex items-center justify-end min-w-[12rem]">
          {displayedUsername ? (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded bg-red-50 dark:bg-zinc-700 text-zinc-900 dark:text-white hover:bg-red-100 dark:hover:bg-zinc-600 transition"
                style={{ borderColor: "#cc0033" }}
              >
                <span>{displayedUsername}</span>
              </button>
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-700 rounded shadow-lg z-50">
                  <Link href="/profile" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-red-50 dark:hover:bg-zinc-600">
                    View Profile
                  </Link>
                  <Link href="/settings" className="block px-4 py-2 text-zinc-900 dark:text-white hover:bg-red-50 dark:hover:bg-zinc-600">
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-zinc-900 dark:text-white hover:bg-red-50 dark:hover:bg-zinc-600"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // placeholder to preserve navbar height and layout while loading
            <div aria-hidden className="w-36 h-10 rounded bg-transparent" />
          )}
        </div>
      </div>
    </nav>
  );
}
