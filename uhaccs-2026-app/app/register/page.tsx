"use client";

import React from "react";
import { RegisterForm } from "../../components/AuthForms";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900 p-8">
      <div className="w-full max-w-xl rounded bg-white/90 dark:bg-zinc-800/90 p-8 shadow">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-white">Create an account</h1>
        <RegisterForm />
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
          Already have an account? <Link href="/login" className="font-semibold" style={{ color: "#cc0033" }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
