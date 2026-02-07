import fs from "fs/promises";
import path from "path";
import {
  scrapeLivingstonAllMeals,
  scrapeAtriumAllMeals,
  enrichFoodItemsWithNutrition,
  type FoodItem,
} from "../../web_scraper/webscraper";

async function writeFoodJson(filePath: string, data: FoodItem[]) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function dedupe(items: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const it of items) {
    const key = `${it.campus}|${it.date}|${it.meal}|${it.foodname}|${it.link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function countBy<T extends string>(arr: FoodItem[], keyFn: (x: FoodItem) => T) {
  const m = new Map<T, number>();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Object.fromEntries(m.entries());
}

export default async function Page() {
  const foodJsonPath = path.join(process.cwd(), "food.json");

  const start = Date.now();

  try {
    // 1) scrape menu items (Breakfast + Lunch + Dinner) for BOTH campuses
    const [livingstonRaw, atriumRaw] = await Promise.all([
      scrapeLivingstonAllMeals(),
      scrapeAtriumAllMeals(),
    ]);

    const scraped = dedupe([...livingstonRaw, ...atriumRaw]);

    // 2) enrich with cached nutrition labels (concurrency limited)
    const enriched = await enrichFoodItemsWithNutrition(scraped, {
      concurrency: 8, // slightly higher; caching prevents repeated work
      skipIfAlreadyHasNutrition: true,
    });

    const finalItems = dedupe(enriched);

    // 3) ALWAYS rewrite food.json fresh
    await writeFoodJson(foodJsonPath, finalItems);

    const ms = Date.now() - start;

    const counts = {
      total: finalItems.length,
      withNutrition: finalItems.filter((x) => x.nutrition?.calories !== undefined).length,
      withSection: finalItems.filter((x) => !!x.section).length,
      campuses: countBy(finalItems, (x) => x.campus),
      meals: countBy(finalItems, (x) => x.meal),
    };

    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Scrape (Livingston + Atrium) complete ✅</h1>

        <ul>
          <li>
            Total items written to <code>food.json</code>: <b>{counts.total}</b>
          </li>
          <li>
            Items with nutrition parsed: <b>{counts.withNutrition}</b>
          </li>
          <li>
            Items with section detected: <b>{counts.withSection}</b>
          </li>
          <li>
            Runtime: <b>{(ms / 1000).toFixed(1)}s</b>
          </li>
        </ul>

        <h2>Counts</h2>
        <pre
          style={{
            background: "#111",
            color: "#eee",
            padding: 16,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(counts, null, 2)}
        </pre>

        <h2>Preview (first 10)</h2>
        <pre
          style={{
            background: "#111",
            color: "#eee",
            padding: 16,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(finalItems.slice(0, 10), null, 2)}
        </pre>

        <p style={{ marginTop: 16, opacity: 0.8 }}>
          Refresh this page to run it again. Subsequent runs should be much faster due to disk caching.
        </p>
      </main>
    );
  } catch (err: any) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Scrape failed ❌</h1>
        <pre
          style={{
            background: "#111",
            color: "#eee",
            padding: 16,
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {String(err?.message ?? err)}
        </pre>
      </main>
    );
  }
}
