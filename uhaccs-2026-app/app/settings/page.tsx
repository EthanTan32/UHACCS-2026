"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/Navbar";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [usernameUpdating, setUsernameUpdating] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/login");
        return;
      }

      if (data.user?.email) {
        setUsername(data.user.email.replace("@app.local", ""));
        setNewUsername(data.user.email.replace("@app.local", ""));
      }

      setLoading(false);
    };

    loadUser();
  }, [router]);



  async function signOut() {
    await supabase.auth.signOut();
    setUsername(null);
    router.push("/login");
  }

  const handleUpdateUsername = async () => {
    if (!newUsername || !newUsername.trim()) {
      alert("Please enter a valid username.");
      return;
    }

    setUsernameUpdating(true);

    try {
      const email = `${newUsername.trim()}@app.local`;
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        alert(`Error updating username: ${error.message}`);
        setUsernameUpdating(false);
        return;
      }

      setUsername(newUsername.trim());
      alert("Username updated.");
    } catch (err) {
      console.error(err);
      alert("Unexpected error updating username.");
    } finally {
      setUsernameUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        alert(`Error updating password: ${error.message}`);
        setPasswordUpdating(false);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      alert("Password updated.");
    } catch (err) {
      console.error(err);
      alert("Unexpected error updating password.");
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        // Delete user profile from database
        const { error: deleteProfileError } = await supabase
          .from("user_profiles")
          .delete()
          .eq("user_id", userData.user.id);

        if (deleteProfileError) {
          alert("Error deleting profile. Please try again.");
          setDeleteLoading(false);
          return;
        }

        // Delete auth user from Supabase
        const deleteResponse = await fetch("/api/delete-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userData.user.id }),
        });

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          alert(`Error deleting account: ${errorData.error}`);
          setDeleteLoading(false);
          return;
        }

        // Sign out and redirect
        await supabase.auth.signOut();
        router.push("/login");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Error deleting account");
      setDeleteLoading(false);
    }
  };

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
            Settings
          </h1>

          {/* Contact Us */}
          <div className="mb-8 pb-8 border-b border-zinc-300 dark:border-zinc-600">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Contact Us
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 mb-4">
              Have questions or feedback? Get in touch with us:
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Email:</p>
                <a
                  href="mailto:info@scarleteats.com"
                  className="text-red-600 dark:text-red-400 hover:underline font-semibold"
                  style={{ color: "#cc0033" }}
                >
                  info@scarleteats.com
                </a>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Support:</p>
                <a
                  href="mailto:support@scarleteats.com"
                  className="text-red-600 dark:text-red-400 hover:underline font-semibold"
                  style={{ color: "#cc0033" }}
                >
                  support@scarleteats.com
                </a>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div className="mb-8 pb-8 border-b border-zinc-300 dark:border-zinc-600">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Account
            </h2>

            {/* Change Username */}
            <div className="mb-6">
              <p className="text-zinc-700 dark:text-zinc-300 mb-2">Change username</p>
              <div className="flex gap-3">
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="new username"
                />
                <button
                  onClick={handleUpdateUsername}
                  disabled={usernameUpdating}
                  className="px-4 py-2 rounded text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
                  style={{ backgroundColor: "#cc0033" }}
                >
                  {usernameUpdating ? "Saving..." : "Save"}
                </button>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">Your username will become your login email (username@app.local).</p>
            </div>

            {/* Change Password */}
            <div>
              <p className="text-zinc-700 dark:text-zinc-300 mb-2">Change password</p>
              <div className="space-y-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="New password"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  placeholder="Confirm new password"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleUpdatePassword}
                    disabled={passwordUpdating}
                    className="px-4 py-2 rounded text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
                    style={{ backgroundColor: "#cc0033" }}
                  >
                    {passwordUpdating ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Delete Account */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Danger Zone
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 mb-4">
              Permanently delete your account and all associated data.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded text-white font-semibold hover:opacity-90 transition"
                style={{ backgroundColor: "#cc0033" }}
              >
                Delete Account
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded p-4 space-y-4">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white mb-2">
                    Are you sure you want to delete your account?
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    This action cannot be undone. All your data, including your profile and history, will be permanently deleted.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                    className="px-4 py-2 rounded text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
                    style={{ backgroundColor: "#cc0033" }}
                  >
                    {deleteLoading ? "Deleting..." : "Yes, Delete Account"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 rounded bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-white font-semibold hover:bg-zinc-400 dark:hover:bg-zinc-500 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
