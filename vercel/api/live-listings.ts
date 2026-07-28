// api/live-listings.ts
//
// Standalone Vercel Serverless Function — this file (plus package.json /
// tsconfig.json below) is meant to live in its OWN Vercel project, separate
// from your Vite app. Deploy just this project; your Vite app calls it
// cross-origin over HTTPS.
//
// Called from the UI via getLiveCars() in lib/cars.ts:
//   POST https://<this-project>.vercel.app/api/live-listings
//   body: { existingCars: CarCard[] }   (CarCard now includes externalId)
//
// What it does, mirroring supabase/functions/scrape-listings/index.ts:
//   1. Fetches every page of Cars24 + Spinny listings.
//   2. Diffs against the `existingCars` the client posted (this is exactly
//      the currently-active `cars` rows, since getCars() only ever selects
//      is_active = true) — no extra DB read needed to know what's new vs.
//      changed vs. unchanged, since externalId + originalPrice + id are all
//      right there in the payload.
//   3. Only WRITES rows that are brand new or whose price changed. Unchanged
//      rows are skipped entirely — this endpoint can be hit on every page
//      load, so we avoid needless writes.
//   4. Marks cars that disappeared from this run as inactive (per source).
//   5. Returns the full current active dataset in the shape transformCars()
//      in lib/cars.ts expects.
//
// Required env vars (Vercel Project Settings -> Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGIN              - your Vite app's origin, e.g.
//                                  https://your-app.vercel.app
//                                  (comma-separate multiple; defaults to "*")

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------------------
// Config — mirrors fetchCars24.js / fetchSpinny.js / scrape-listings
// ----------------------------------------------------------------------------

const CARS24_CONFIG = {
  citySlug: "buy-used-cars-bangalore",
  cityId: "4709",
  sort: "plh",
  pageSize: 20,
  filterVersion: 4,
  searchFilter: [
    "businessVertical:=:gs",
    "odometer:bw:0,75000",
    "transmission:=:automatic;transmissionSubType:in:tc,cvt,dct,ivt",
    "year:bw:2021,2026",
  ],
};
const CARS24_ENDPOINT = `https://car-catalog-gateway-in.c24.tech/listing/v1/${CARS24_CONFIG.citySlug}`;

const SPINNY_CONFIG = {
  baseParams: {
    max_mileage: "75000",
    min_year: "2020",
    o: "price",
    transmission_sub_type: "cvt,dct,tc",
    city: "bangalore",
    show_max_on_assured: "true",
    custom_budget_sort: "true",
    prioritize_filter_listing: "true",
    high_intent_required: "false",
    active_banner: "true",
    added_in_inventory: "true",
    is_pulse_exp: "false",
    is_recommended_exp: "false",
    is_new_price: "false",
    listing_widget_exp: "undefined",
  },
};
const SPINNY_ENDPOINT = "https://api.spinny.com/v3/api/listing/v6/";

const MAX_PAGES_SAFETY = 50;
const CHUNK = 200;

type NormalizedCar = {
  source: "cars24" | "spinny";
  external_id: string;
  price: number;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  city: string | null;
  fuel_type: string | null;
  transmission: string | null;
  odometer_km: number | null;
  raw: unknown;
};

// Minimal shape we rely on from the client's CarCard[] payload
type ExistingCar = {
  id: string;
  externalId: string;
  source: "cars24" | "spinny";
  originalPrice: number;
};

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

function applyCors(req: VercelRequest, res: VercelResponse) {
  const allowed = (process.env.ALLOWED_ORIGIN ?? "*")
    .split(",")
    .map((o) => o.trim());

  const origin = req.headers.origin as string | undefined;
  const allowOrigin =
    allowed.includes("*") ? "*" : origin && allowed.includes(origin) ? origin : allowed[0];

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

// ----------------------------------------------------------------------------
// Cars24 fetcher
// ----------------------------------------------------------------------------

function findSearchAfter(data: any): unknown {
  if (data.searchAfter) return data.searchAfter;
  if (data.page?.searchAfter) return data.page.searchAfter;
  const seen = new Set<any>();
  const stack: any[] = [data];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (!Array.isArray(node) && node.searchAfter) return node.searchAfter;
    for (const v of Array.isArray(node) ? node : Object.values(node)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

async function fetchCars24Page(searchAfter: unknown) {
  const res = await fetch(CARS24_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      origin: "https://www.cars24.com",
      referer: "https://www.cars24.com/",
      source: "WebApp",
      x_tenant_id: "INDIA_CAR_LISTING",
      x_user_city_id: CARS24_CONFIG.cityId,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    body: JSON.stringify({
      searchFilter: CARS24_CONFIG.searchFilter,
      cityId: CARS24_CONFIG.cityId,
      sort: CARS24_CONFIG.sort,
      size: CARS24_CONFIG.pageSize,
      searchAfter: searchAfter ?? null,
      filterVersion: CARS24_CONFIG.filterVersion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Cars24 request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllCars24(): Promise<NormalizedCar[]> {
  let searchAfter: unknown = null;
  const out: NormalizedCar[] = [];
  for (let page = 0; page < MAX_PAGES_SAFETY; page++) {
    const data = await fetchCars24Page(searchAfter);
    const content: any[] = data.content || [];
    for (const car of content) {
      out.push({
        source: "cars24",
        external_id: String(car.appointmentId),
        price: Number(car.listingPrice),
        make: car.make ?? null,
        model: car.model ?? null,
        variant: car.variant ?? null,
        year: car.year ?? null,
        city: CARS24_CONFIG.citySlug.replace("buy-used-cars-", ""),
        fuel_type: car.fuelType ?? null,
        transmission: car.transmissionType?.value ?? null,
        odometer_km: car.odometer?.value ?? null,
        raw: car,
      });
    }
    if (content.length < CARS24_CONFIG.pageSize) break;
    const next = findSearchAfter(data);
    if (!next) break;
    searchAfter = next;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Spinny fetcher
// ----------------------------------------------------------------------------

async function fetchSpinnyPage(pageNum: number) {
  const params = new URLSearchParams({
    ...SPINNY_CONFIG.baseParams,
    page: String(pageNum),
  });
  const res = await fetch(`${SPINNY_ENDPOINT}?${params.toString()}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      referer: "https://www.spinny.com/",
      origin: "https://www.spinny.com",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Spinny request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllSpinny(): Promise<NormalizedCar[]> {
  const out: NormalizedCar[] = [];
  for (let page = 1; page <= MAX_PAGES_SAFETY; page++) {
    const data = await fetchSpinnyPage(page);
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0) break;
    for (const car of results) {
      out.push({
        source: "spinny",
        external_id: String(car.id),
        price: Number(car.price),
        make: car.make ?? null,
        model: car.model ?? null,
        variant: car.variant ?? null,
        year: car.make_year ?? null,
        city: car.city ?? null,
        fuel_type: car.fuel_type ?? null,
        transmission: car.transmission ?? null,
        odometer_km: car.mileage ?? null,
        raw: car,
      });
    }
    if (data.next === undefined ? false : !data.next) break;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars" });
    return;
  }

  const existingCars: ExistingCar[] = Array.isArray(req.body?.existingCars)
    ? req.body.existingCars
    : [];

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch live listings from both sources
    const [cars24, spinny] = await Promise.all([
      fetchAllCars24().catch((err) => {
        console.error("cars24 fetch failed:", err);
        return [] as NormalizedCar[];
      }),
      fetchAllSpinny().catch((err) => {
        console.error("spinny fetch failed:", err);
        return [] as NormalizedCar[];
      }),
    ]);

    const allCars = [...cars24, ...spinny];

    if (allCars.length === 0) {
      res.status(502).json({ error: "Both Cars24 and Spinny fetches failed or returned nothing" });
      return;
    }

    // 2. Build a lookup from what the client already has (its is_active=true
    // rows from getCars()) — this tells us exactly what's new vs. changed
    // vs. unchanged, with zero extra DB reads.
    const existingMap = new Map<string, ExistingCar>();
    for (const c of existingCars) {
      if (!c.externalId || !c.source) continue;
      existingMap.set(`${c.source}:${c.externalId}`, c);
    }

    const now = new Date().toISOString();

    const toInsert: any[] = [];
    const toUpdate: { id: string; fields: any }[] = [];
    const changed: { key: string; carId?: string; price: number }[] = [];

    for (const c of allCars) {
      const key = `${c.source}:${c.external_id}`;
      const existing = existingMap.get(key);

      const fields = {
        make: c.make,
        model: c.model,
        variant: c.variant,
        year: c.year,
        city: c.city,
        fuel_type: c.fuel_type,
        transmission: c.transmission,
        odometer_km: c.odometer_km,
        latest_price: c.price,
        raw_json: c.raw,
        last_seen_at: now,
        updated_at: now,
        is_active: true,
      };

      if (!existing) {
        toInsert.push({
          source: c.source,
          external_id: c.external_id,
          first_seen_at: now,
          ...fields,
        });
        changed.push({ key, price: c.price });
        continue;
      }

      const priceChanged = Number(existing.originalPrice) !== c.price;
      if (priceChanged) {
        toUpdate.push({ id: existing.id, fields });
        changed.push({ key, carId: existing.id, price: c.price });
      }
      // else: unchanged -> skip entirely, no write
    }

    // 3. Write new rows
    const insertedIds = new Map<string, string>(); // "source:external_id" -> id
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("cars")
        .insert(chunk)
        .select("id, source, external_id");
      if (error) throw error;
      for (const row of data ?? []) {
        insertedIds.set(`${row.source}:${row.external_id}`, row.id);
      }
    }

    // 4. Write updates (per row, since each has a different id + fields)
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(({ id, fields }) => supabase.from("cars").update(fields).eq("id", id))
      );
      for (const { error } of results) {
        if (error) throw error;
      }
    }

    // 5. Price history — only for rows that actually changed (new or price diff)
    if (changed.length > 0) {
      const today = now.slice(0, 10); // YYYY-MM-DD

      const historyRows = changed
        .map(({ key, carId, price }) => {
          const resolvedId = carId ?? insertedIds.get(key);
          if (!resolvedId) return null;
          return { car_id: resolvedId, scraped_date: today, price, is_active: true };
        })
        .filter(Boolean) as { car_id: string; scraped_date: string; price: number; is_active: boolean }[];

      for (let i = 0; i < historyRows.length; i += CHUNK) {
        const chunk = historyRows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("car_price_history")
          .upsert(chunk, { onConflict: "car_id,scraped_date" });
        if (error) console.error("failed to write price history chunk:", error);
      }
    }

    // 6. Mark cars that disappeared from this run as inactive (per source),
    // using the client's existingCars as the "previously active" set.
    for (const source of ["cars24", "spinny"] as const) {
      const seenIds = new Set(
        allCars.filter((c) => c.source === source).map((c) => c.external_id)
      );
      const disappearedIds = existingCars
        .filter((c) => c.source === source && !seenIds.has(c.externalId))
        .map((c) => c.id);

      if (disappearedIds.length === 0) continue;

      for (let i = 0; i < disappearedIds.length; i += CHUNK) {
        const chunk = disappearedIds.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("cars")
          .update({ is_active: false, updated_at: now })
          .in("id", chunk);
        if (error) console.error(`failed to mark stale ${source} cars inactive:`, error);
      }
    }

    // 7. Return the full current active dataset for the UI to render
    // (same column shape lib/cars.ts's transformCars() already expects).
    const { data: finalRows, error: finalErr } = await supabase
      .from("cars")
      .select(
        "id, source, external_id, make, model, variant, year, city, odometer_km, latest_price, raw_json"
      )
      .eq("is_active", true);

    if (finalErr) throw finalErr;

    res.status(200).json(finalRows ?? []);
  } catch (err) {
    console.error("live-listings error:", err);
    res.status(500).json({ error: String(err) });
  }
}