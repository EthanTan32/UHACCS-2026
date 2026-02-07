import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-red-50 dark:from-black dark:to-zinc-900">
      <main className="mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-extrabold leading-tight text-zinc-900 dark:text-white sm:text-5xl">
          Scarlet Eats
        </h1>

        <p className="mt-3 text-xl italic text-[#cc0033]">Eat Smarter at Rutgers</p>

        <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl mx-auto">
          Eating healthy at Rutgers can be a pain, we can help. Get specialized diets tailored specifically to meal-swipable dining locations at Rutgers.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center rounded-md px-6 py-3 text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: "#cc0033" }}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border px-5 py-3 text-sm font-medium bg-white/80 hover:bg-red-50"
            style={{ borderColor: "#ffd6dc", color: "#cc0033" }}
          >
            Sign in
          </Link>
        </div>

        <footer className="mt-12 text-sm text-zinc-600 dark:text-zinc-400">
          Built for UHACCS 2026
        </footer>
      </main>
    </div>
  );
}
