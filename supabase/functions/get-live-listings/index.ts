// supabase/functions/get-live-listings/index.ts
//
// Fetches live vehicle listings from Cars24 and Spinny and returns them
// directly to the UI in a normalized JSON array format.
//
// Deploy: supabase functions deploy get-live-listings --no-verify-jwt

import { corsHeaders } from "../_shared/cors.ts";

// ----------------------------------------------------------------------------
// Config
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

// Note: You might want to lower this for synchronous UI calls to prevent slow load times/timeouts.
const MAX_PAGES_SAFETY = 50; 

type LiveCarData = {
  id: string;
  source: "cars24" | "spinny";
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  city: string | null;
  odometer_km: number | null;
  latest_price: number;
  raw_json: any;
};

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

async function fetchAllCars24(): Promise<LiveCarData[]> {
  let searchAfter: unknown = null;
  const out: LiveCarData[] = [];
  for (let page = 0; page < MAX_PAGES_SAFETY; page++) {
    const data = await fetchCars24Page(searchAfter);
    const content: any[] = data.content || [];
    for (const car of content) {
      out.push({
        id: crypto.randomUUID(),
        source: "cars24",
        make: car.make ?? null,
        model: car.model ?? null,
        variant: car.variant ?? null,
        year: car.year ?? null,
        city: CARS24_CONFIG.citySlug.replace("buy-used-cars-", ""),
        odometer_km: car.odometer?.value ?? null,
        latest_price: Number(car.listingPrice),
        raw_json: car,
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

async function fetchAllSpinny(): Promise<LiveCarData[]> {
  const out: LiveCarData[] = [];
  for (let page = 1; page <= MAX_PAGES_SAFETY; page++) {
    const data = await fetchSpinnyPage(page);
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    if (results.length === 0) break;
    for (const car of results) {
      out.push({
        id: crypto.randomUUID(),
        source: "spinny",
        make: car.make ?? null,
        model: car.model ?? null,
        variant: car.variant ?? null,
        year: car.make_year ?? null,
        city: car.city ?? null,
        odometer_km: car.mileage ?? null,
        latest_price: Number(car.price),
        raw_json: car,
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
  // Handle CORS Preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const [cars24, spinny] = await Promise.all([
      fetchAllCars24().catch((err) => {
        console.error("cars24 fetch failed:", err);
        return [] as LiveCarData[];
      }),
      fetchAllSpinny().catch((err) => {
        console.error("spinny fetch failed:", err);
        return [] as LiveCarData[];
      }),
    ]);

    const allCars = [...cars24, ...spinny];

    return new Response(JSON.stringify(allCars), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});