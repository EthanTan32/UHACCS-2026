import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type Meal = "Breakfast" | "Lunch" | "Dinner";

export type Campus = "livingston" | "atrium";

export type NutritionInfo = {
  servingSize?: string; // from label.aspx, e.g. "1 EACH"
  calories?: number;

  totalFat_g?: number;
  satFat_g?: number;
  cholesterol_mg?: number;
  sodium_mg?: number;

  totalCarb_g?: number;
  dietaryFiber_g?: number;
  protein_g?: number;

  ingredients?: string; // cleaned text after "INGREDIENTS:"
};

export type FoodItem = {
  campus: Campus;
  meal: Meal;
  section?: string; // <-- NEW: e.g. "Salad Bar", "Grill", "Pizza", etc.
  foodname: string;
  link: string; // label.aspx URL
  date: string; // YYYY-MM-DD

  // from pickmenu.aspx (menu page), if we can detect it
  portionSize?: string;

  // from label.aspx
  nutrition?: NutritionInfo;
};

/* =========================
   CONFIG
========================= */

const BASE_URL = "https://menuportal23.dining.rutgers.edu/foodpronet/";

// blacklist words (lowercase)
const BLACKLIST = ["build", "custom", "create your own"];

// Campus config (based on your Livingston setup + the Atrium URL you sent)
const CAMPUS_CONFIG: Record<
  Campus,
  { locationNum: string; locationName: string; campusLabel: Campus }
> = {
  livingston: {
    locationNum: "03",
    locationName: "Livingston Dining Commons",
    campusLabel: "livingston",
  },
  atrium: {
    locationNum: "13",
    locationName: "The Atrium",
    campusLabel: "atrium",
  },
};

/* =========================
   DISK CACHE
========================= */

const CACHE_DIR = path.join(process.cwd(), ".cache", "rutgers_menu");
const MENU_HTML_DIR = path.join(CACHE_DIR, "menu_html");
const LABEL_JSON_DIR = path.join(CACHE_DIR, "label_json");

// Keep menu HTML cache fairly short (menus can change day-of)
const MENU_HTML_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

// Nutrition labels almost never change
const LABEL_JSON_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

async function ensureCacheDirs() {
  await fs.mkdir(MENU_HTML_DIR, { recursive: true });
  await fs.mkdir(LABEL_JSON_DIR, { recursive: true });
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

async function readCacheIfFresh(filePath: string, ttlMs: number): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    const age = Date.now() - stat.mtimeMs;
    if (age > ttlMs) return null;
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, content: string) {
  await fs.writeFile(filePath, content, "utf8");
}

/* =========================
   DATE HELPERS
========================= */

// Rutgers expects M/D/YYYY (no leading zeros)
function getRutgersDate(date = new Date()): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

// Store ISO date for sanity
function getISODate(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * Build menu URLs.
 * - Breakfast is default view (no activeMeal)
 * - Lunch/Dinner use activeMeal=Lunch|Dinner
 */
function buildMenuUrl(campus: Campus, date: Date, meal: Meal) {
  const cfg = CAMPUS_CONFIG[campus];
  const rutgersDate = getRutgersDate(date);

  const base =
    "https://menuportal23.dining.rutgers.edu/foodpronet/pickmenu.aspx" +
    `?locationNum=${encodeURIComponent(cfg.locationNum)}` +
    `&locationName=${encodeURIComponent(cfg.locationName).replace(/%20/g, "+")}` +
    `&dtdate=${encodeURIComponent(rutgersDate)}` +
    `&sName=Rutgers+University+Dining`;

  if (meal === "Breakfast") return base;
  return `${base}&activeMeal=${encodeURIComponent(meal)}`;
}

/* =========================
   UTILS
========================= */

function toAbsoluteUrl(href: string) {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href.replace(/^\/+/, ""), BASE_URL).toString();
}

function isBlacklisted(foodName: string): boolean {
  const name = foodName.toLowerCase();
  return BLACKLIST.some((word) => name.includes(word));
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

// Very small concurrency limiter (no extra deps)
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

/* =========================
   SECTION DETECTION (best-effort)
   Goal: Baby Spinach -> "Salad Bar" etc.
========================= */

function normalizeSectionName(s: string) {
  const cleaned = s.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  // Avoid super generic section titles
  if (/^menu$/i.test(cleaned)) return undefined;
  return cleaned;
}

function detectSectionForFieldset($: cheerio.CheerioAPI, fieldsetEl: any): string | undefined {
  // Rutgers markup varies. Best-effort approach:
  // Look backwards from the fieldset for nearby headings or legends.
  const fieldset = $(fieldsetEl);

  // 1) Sometimes a <legend> exists in same fieldset
  const legend = fieldset.find("legend").first().text().trim();
  if (legend) return normalizeSectionName(legend);

  // 2) Look for the nearest previous heading element
  const prevHeading = fieldset
    .prevAll("h1,h2,h3,h4,legend,.category,.menu-category,.menuCat,.station")
    .first()
    .text()
    .trim();
  if (prevHeading) return normalizeSectionName(prevHeading);

  // 3) Sometimes section is wrapped in a parent with a header
  const parentHeading = fieldset
    .parent()
    .find("h1,h2,h3,h4,legend,.category,.menu-category,.menuCat,.station")
    .first()
    .text()
    .trim();
  if (parentHeading) return normalizeSectionName(parentHeading);

  return undefined;
}

/* =========================
   MENU SCRAPER (pickmenu.aspx)
   - Food name
   - Link to label.aspx
   - Portion size (best-effort)
   - Section (best-effort)
========================= */

export async function scrapeCampusMeal(
  campus: Campus,
  meal: Meal,
  date: Date = new Date()
): Promise<FoodItem[]> {
  await ensureCacheDirs();

  const menuUrl = buildMenuUrl(campus, date, meal);
  const isoDate = getISODate(date);

  const cacheKey = `${campus}_${isoDate}_${meal}.html`;
  const cachePath = path.join(MENU_HTML_DIR, cacheKey);

  let html = await readCacheIfFresh(cachePath, MENU_HTML_TTL_MS);
  if (!html) {
    const res = await fetch(menuUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RutgersMenuScraper/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Fetch failed for ${campus} ${meal}: ${res.status} ${res.statusText}`
      );
    }

    html = await res.text();
    await writeCache(cachePath, html);
  }

  const $ = cheerio.load(html);

  const results: FoodItem[] = [];

  $("fieldset").each((_, el) => {
    const foodName = $(el).find(".col-1 label").first().text().trim();
    if (!foodName) return;
    if (isBlacklisted(foodName)) return;

    const href = $(el).find(".col-3 a").attr("href")?.trim();
    if (!href) return;

    // Portion size best-effort
    const fieldsetText = $(el).text().replace(/\s+/g, " ").trim();
    let portionSize: string | undefined;

    const portionMatch =
      fieldsetText.match(/portion\s*(size)?\s*[:\-]\s*([^\|]+?)(?=$|\s{2,}|\|)/i) ||
      fieldsetText.match(/portion\s*[:\-]\s*([^\|]+?)(?=$|\s{2,}|\|)/i);

    if (portionMatch) {
      portionSize = (portionMatch[2] ?? portionMatch[1])?.trim();
    } else {
      const col2 = $(el).find(".col-2").text().replace(/\s+/g, " ").trim();
      if (col2) portionSize = col2;
    }

    const section = detectSectionForFieldset($, el);

    results.push({
      campus,
      meal,
      section,
      foodname: foodName,
      link: toAbsoluteUrl(href),
      date: isoDate,
      portionSize: portionSize || undefined,
    });
  });

  return dedupe(results);
}

export async function scrapeCampusAllMeals(
  campus: Campus,
  date: Date = new Date()
): Promise<FoodItem[]> {
  const meals: Meal[] = ["Breakfast", "Lunch", "Dinner"];
  const lists = await Promise.all(meals.map((m) => scrapeCampusMeal(campus, m, date)));
  return dedupe(lists.flat());
}

/* Backwards-compatible exports (if you already import these elsewhere) */
export async function scrapeLivingstonAllMeals(date: Date = new Date()) {
  return scrapeCampusAllMeals("livingston", date);
}
export async function scrapeAtriumAllMeals(date: Date = new Date()) {
  return scrapeCampusAllMeals("atrium", date);
}

/* =========================
   NUTRITION SCRAPER (label.aspx)
========================= */

function parseNumber(s: string): number | undefined {
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

function parseAmount(
  text: string
): { value?: number; unit?: "g" | "mg" } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const unitMatch = cleaned.match(/(-?\d+(\.\d+)?)\s*(mg|g)\b/i);
  if (!unitMatch) return {};
  return {
    value: parseNumber(unitMatch[1]),
    unit: unitMatch[3].toLowerCase() as "g" | "mg",
  };
}

function cleanIngredients(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^ingredients:\s*/i, "")
    .trim();
}

async function scrapeNutritionLabelNoCache(labelUrl: string): Promise<NutritionInfo> {
  const res = await fetch(labelUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RutgersMenuScraper/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Label fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const out: NutritionInfo = {};

  // Serving size appears like: <p>Serving Size 1 EACH</p>
  const factsText = $("#facts").text().replace(/\s+/g, " ").trim();
  const servingMatch = factsText.match(/Serving Size\s*([^\n\r]+)/i);
  if (servingMatch?.[1]) {
    out.servingSize = servingMatch[1].trim();
  }

  // Calories appears like: <p class="strong">Calories 85</p>
  const caloriesText = $("#facts p.strong")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (/calories/i.test(caloriesText)) {
    out.calories = parseNumber(caloriesText);
  }

  const tdTexts = $("#specs table td")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get();

  function findCell(labelRegex: RegExp): string | undefined {
    return tdTexts.find((t) => labelRegex.test(t));
  }

  const totalFatCell = findCell(/Total Fat/i);
  if (totalFatCell) {
    const a = parseAmount(totalFatCell);
    if (a.unit === "g") out.totalFat_g = a.value;
  }

  const satFatCell = findCell(/Sat\.?\s*Fat/i);
  if (satFatCell) {
    const a = parseAmount(satFatCell);
    if (a.unit === "g") out.satFat_g = a.value;
  }

  const cholesterolCell = findCell(/Cholesterol/i);
  if (cholesterolCell) {
    const a = parseAmount(cholesterolCell);
    if (a.unit === "mg") out.cholesterol_mg = a.value;
  }

  const sodiumCell = findCell(/Sodium/i);
  if (sodiumCell) {
    const a = parseAmount(sodiumCell);
    if (a.unit === "mg") out.sodium_mg = a.value;
  }

  const totalCarbCell = findCell(/Tot\.?\s*Carb/i);
  if (totalCarbCell) {
    const a = parseAmount(totalCarbCell);
    if (a.unit === "g") out.totalCarb_g = a.value;
  }

  const fiberCell = findCell(/Dietary Fiber/i);
  if (fiberCell) {
    const a = parseAmount(fiberCell);
    if (a.unit === "g") out.dietaryFiber_g = a.value;
  }

  const proteinCell = findCell(/Protein/i);
  if (proteinCell) {
    const a = parseAmount(proteinCell);
    if (a.unit === "g") out.protein_g = a.value;
  }

  const ingP = $("p")
    .filter((_, el) => $(el).text().trim().toUpperCase().startsWith("INGREDIENTS:"))
    .first()
    .text()
    .trim();

  if (ingP) out.ingredients = cleanIngredients(ingP);

  return out;
}

export async function scrapeNutritionLabel(labelUrl: string): Promise<NutritionInfo> {
  await ensureCacheDirs();

  const key = sha1(labelUrl) + ".json";
  const cachePath = path.join(LABEL_JSON_DIR, key);

  const cached = await readCacheIfFresh(cachePath, LABEL_JSON_TTL_MS);
  if (cached) {
    try {
      return JSON.parse(cached) as NutritionInfo;
    } catch {
      // fallthrough
    }
  }

  const nutrition = await scrapeNutritionLabelNoCache(labelUrl);
  await writeCache(cachePath, JSON.stringify(nutrition));
  return nutrition;
}

/* =========================
   ENRICH ITEMS WITH NUTRITION
========================= */

export async function enrichFoodItemsWithNutrition(
  items: FoodItem[],
  opts?: { concurrency?: number; skipIfAlreadyHasNutrition?: boolean }
): Promise<FoodItem[]> {
  const concurrency = opts?.concurrency ?? 6;
  const skipIfAlreadyHasNutrition = opts?.skipIfAlreadyHasNutrition ?? true;

  return mapWithConcurrency(items, concurrency, async (item) => {
    if (skipIfAlreadyHasNutrition && item.nutrition) return item;

    try {
      const nutrition = await scrapeNutritionLabel(item.link);
      return { ...item, nutrition };
    } catch {
      return item;
    }
  });
}
