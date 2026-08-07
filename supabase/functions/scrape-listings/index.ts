// supabase/functions/scrape-listings/index.ts
//
// Runs on a schedule (Supabase Cron -> pg_net -> this function) and can also
// be invoked manually. It fetches every page of Cars24 + Spinny listings,
// upserts each car's CURRENT snapshot into `cars` (raw_json overwritten each
// run), and appends one row per car per calendar day into
// `car_price_history` (unbounded — never pruned).
//
// Required secrets (set via `supabase secrets set ...`):
//   SUPABASE_URL              - auto-provided by the platform
//   SUPABASE_SERVICE_ROLE_KEY - auto-provided by the platform
//   CRON_SECRET                - your own secret, checked against the
//                                 `x-cron-secret` header so randoms on the
//                                 internet can't trigger scrapes (see README)
//
// Deploy:  supabase functions deploy scrape-listings --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ----------------------------------------------------------------------------
// Config — mirrors fetchCars24.js / fetchSpinny.js
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

// Exter-only Cars24 listing call — separate endpoint (not city-slug scoped)
// that returns just the Hyundai Exter automatic listings. Runs in parallel
// with the main Cars24 fetch; results are merged into the same "cars24"
// bucket downstream (same source, same external_id space).
const CARS24_EXTER_CONFIG = {
  cityId: "4709",
  sort: "plh",
  pageSize: 20,
  filterVersion: 4,
  searchFilter: [
    "businessVertical:=:gs",
    "transmission:=:automatic;transmissionSubType:in:amt",
    "make:=:hyundai;model:in:exter",
  ],
};
const CARS24_EXTER_ENDPOINT = "https://car-catalog-gateway-in.c24.tech/listing/v1/buy-used-car";

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

// Exter-only Spinny listing call — separate v7 endpoint filtered to the
// Exter model. Runs in parallel with the main Spinny fetch; results are
// merged into the same "spinny" bucket downstream.
const SPINNY_EXTER_CONFIG = {
  baseParams: {
    city: "bangalore",
    product_type: "cars",
    transmission: "automatic",
    model: "exter",
    category: "used",
    show_max_on_assured: "true",
    custom_budget_sort: "true",
    prioritize_filter_listing: "true",
    high_intent_required: "false",
    active_banner: "true",
    added_in_inventory: "true",
    is_pulse_exp: "false",
    is_recommended_exp: "false",
    is_new_price: "true",
    listing_widget_exp: "undefined",
  },
};
const SPINNY_EXTER_ENDPOINT = "https://api.spinny.com/v3/api/listing/v6/";

const MAX_PAGES_SAFETY = 50; // hard stop so a pagination bug can't loop forever

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

// ----------------------------------------------------------------------------
// Cars24 fetcher (ported from fetchCars24.js)
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
    if (content.length < CARS24_CONFIG.pageSize) break; // last page
    const next = findSearchAfter(data);
    if (!next) break;
    searchAfter = next;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Cars24 Exter-only fetcher — hits the generic /buy-used-car endpoint with
// a make/model filter instead of the city-slug endpoint.
// ----------------------------------------------------------------------------

async function fetchCars24ExterPage(searchAfter: unknown) {
  const res = await fetch(CARS24_EXTER_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-GB,en;q=0.6",
      "content-type": "application/json",
      origin: "https://www.cars24.com",
      referer: "https://www.cars24.com/",
      source: "WebApp",
      x_experiment_id: "f1b0239e-5193-4106-a807-d2da7dd3a7ca",
      x_tenant_id: "INDIA_CAR_LISTING",
      x_user_city_id: CARS24_EXTER_CONFIG.cityId,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    body: JSON.stringify({
      searchFilter: CARS24_EXTER_CONFIG.searchFilter,
      cityId: CARS24_EXTER_CONFIG.cityId,
      sort: CARS24_EXTER_CONFIG.sort,
      size: CARS24_EXTER_CONFIG.pageSize,
      searchAfter: searchAfter ?? null,
      filterVersion: CARS24_EXTER_CONFIG.filterVersion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Cars24 (Exter) request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllCars24Exter(): Promise<NormalizedCar[]> {
  let searchAfter: unknown = null;
  const out: NormalizedCar[] = [];
  for (let page = 0; page < MAX_PAGES_SAFETY; page++) {
    const data = await fetchCars24ExterPage(searchAfter);
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
    if (content.length < CARS24_EXTER_CONFIG.pageSize) break; // last page
    const next = findSearchAfter(data);
    if (!next) break;
    searchAfter = next;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Spinny fetcher (ported from fetchSpinny.js)
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
// Spinny Exter-only fetcher — hits the v7 endpoint filtered to model=exter.
// ----------------------------------------------------------------------------

async function fetchSpinnyExterPage(pageNum: number) {
  const params = new URLSearchParams({
    ...SPINNY_EXTER_CONFIG.baseParams,
    page: String(pageNum),
  });
  const res = await fetch(`${SPINNY_EXTER_ENDPOINT}?${params.toString()}`, {
    headers: {
      accept: "*/*",
      "accept-language": "en-GB,en;q=0.7",
      "content-type": "application/json",
      platform: "web",
      "procurement-category": "assured,luxury",
      referer: "https://www.spinny.com/",
      origin: "https://www.spinny.com",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Spinny (Exter) request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAllSpinnyExter(): Promise<NormalizedCar[]> {
  const out: NormalizedCar[] = [];
  for (let page = 1; page <= MAX_PAGES_SAFETY; page++) {
    const data = await fetchSpinnyExterPage(page);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: run } = await supabase
    .from("scrape_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = run?.id;

  try {
    const [cars24Main, spinnyMain, cars24Exter, spinnyExter] = await Promise.all([
      fetchAllCars24().catch((err) => {
        console.error("cars24 fetch failed:", err);
        return [] as NormalizedCar[];
      }),
      fetchAllSpinny().catch((err) => {
        console.error("spinny fetch failed:", err);
        return [] as NormalizedCar[];
      }),
      fetchAllCars24Exter().catch((err) => {
        console.error("cars24 (exter) fetch failed:", err);
        return [] as NormalizedCar[];
      }),
      fetchAllSpinnyExter().catch((err) => {
        console.error("spinny (exter) fetch failed:", err);
        return [] as NormalizedCar[];
      }),
    ]);

    // Merge the Exter-only results into the same per-source buckets used
    // everywhere below (counts, stale-marking, etc). Overlap with the main
    // fetch (an Exter also matching the broad filters) is fine — it's
    // resolved by (source, external_id) at upsert time via ON CONFLICT.
    const cars24 = [...cars24Main, ...cars24Exter];
    const spinny = [...spinnyMain, ...spinnyExter];

    // De-dupe by (source, external_id): the Exter-only calls target the same
    // inventory as the main calls and will frequently overlap, and a single
    // upsert batch can't target the same conflict row twice (Postgres:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"), so
    // collapse to the last-seen copy per key up front.
    const dedupedByKey = new Map<string, NormalizedCar>();
    for (const c of [...cars24, ...spinny]) {
      dedupedByKey.set(`${c.source}:${c.external_id}`, c);
    }
    const allCars = Array.from(dedupedByKey.values());
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

    // 1) Upsert current snapshot into `cars` (raw_json overwritten each run)
    const carRows = allCars.map((c) => ({
      source: c.source,
      external_id: c.external_id,
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
      last_seen_at: new Date().toISOString(),
      is_active: true,
    }));

    const upsertedIds = new Map<string, string>(); // "source:external_id" -> car uuid

    // upsert in chunks to stay well under request size limits
    const CHUNK = 200;
    for (let i = 0; i < carRows.length; i += CHUNK) {
      const chunk = carRows.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("cars")
        .upsert(chunk, { onConflict: "source,external_id" })
        .select("id, source, external_id");
      if (error) throw error;
      for (const row of data ?? []) {
        upsertedIds.set(`${row.source}:${row.external_id}`, row.id);
      }
    }

    // 2) Append today's price history row per car (upsert so re-runs same day don't duplicate)
    const historyRows = allCars
      .map((c) => {
        const carId = upsertedIds.get(`${c.source}:${c.external_id}`);
        if (!carId) return null;
        return {
          car_id: carId,
          scraped_date: today,
          price: c.price,
          is_active: true,
        };
      })
      .filter(Boolean) as { car_id: string; scraped_date: string; price: number; is_active: boolean }[];

    for (let i = 0; i < historyRows.length; i += CHUNK) {
      const chunk = historyRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("car_price_history")
        .upsert(chunk, { onConflict: "car_id,scraped_date" });
      if (error) throw error;
    }

    // 3) Mark cars that disappeared from this run as inactive (per source)
    for (const source of ["cars24", "spinny"] as const) {
      const seenIds = allCars
        .filter((c) => c.source === source)
        .map((c) => c.external_id);
      if (seenIds.length === 0) continue; // don't wipe everything if a source failed
      const { error } = await supabase
        .from("cars")
        .update({ is_active: false })
        .eq("source", source)
        .eq("is_active", true)
        .not("external_id", "in", `(${seenIds.map((id) => `"${id}"`).join(",")})`);
      if (error) console.error(`failed to mark stale ${source} cars inactive:`, error);
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        cars24_count: cars24.length,
        spinny_count: spinny.length,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        cars24: cars24.length,
        spinny: spinny.length,
        total: allCars.length,
        date: today,
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    await supabase
      .from("scrape_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: String(err),
      })
      .eq("id", runId);

    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
