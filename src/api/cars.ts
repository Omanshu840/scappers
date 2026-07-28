import { supabase } from "../lib/supabase";

export type CarCard = {
  id: string;
  externalId: string;
  source: "cars24" | "spinny";
  brand: string;
  carName: string;
  variant: string;
  kmDriven: number | null;
  modelYear: number | null;
  coverImage: string | null;
  price: number;         // adjusted final price
  originalPrice: number;  // price from source table
  location: string | null;
  booked: boolean;
  detailUrl: string | null;
};

function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function normalizeDetailUrl(
  source: "cars24" | "spinny",
  url: string | null | undefined
) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const host = source === "spinny" ? "https://www.spinny.com" : "https://www.cars24.com";
  return url.startsWith("/") ? `${host}${url}` : `${host}/${url}`;
}

function getAdjustedPrice(source: "cars24" | "spinny", price: number) {
  return source === "cars24" ? price + 50000 : price;
}

function getCoverImage(row: any) {
  if (row.source === "cars24") {
    return (
      normalizeImageUrl(row.raw_json?.listingImage?.uri) ??
      normalizeImageUrl(row.raw_json?.detailImage?.uri) ??
      null
    );
  }

  const firstImage = row.raw_json?.images?.[0]?.file?.absurl;
  return normalizeImageUrl(firstImage) ?? null;
}

function getLocation(row: any) {
  if (row.source === "cars24") {
    return row.raw_json?.address?.locality ?? row.city ?? null;
  }

  return (
    row.raw_json?.hub ??
    row.raw_json?.hub_short_name ??
    row.city ??
    null
  );
}

function getBrand(row: any) {
  return row.make ?? row.raw_json?.make ?? "";
}

function getCarName(row: any) {
  if (row.source === "cars24") {
    return row.raw_json?.carName ?? `${row.make ?? ""} ${row.model ?? ""}`.trim();
  }

  return `${row.make ?? ""} ${row.model ?? ""}`.trim();
}

function getKmDriven(row: any) {
  return row.odometer_km ?? row.raw_json?.odometer?.value ?? row.raw_json?.mileage ?? null;
}

function getModelYear(row: any) {
  return row.year ?? row.raw_json?.make_year ?? row.raw_json?.registration_year ?? null;
}

function getBooked(row: any) {
  return row.source === "spinny" && row.raw_json?.booked === true;
}

function findUrlByKeys(value: unknown, keys: string[]) {
  const seen = new Set<unknown>();
  const stack: unknown[] = [value];

  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object" || seen.has(item)) continue;

    seen.add(item);

    if (!Array.isArray(item)) {
      const record = item as Record<string, unknown>;

      for (const key of keys) {
        const maybeUrl = record[key];
        if (typeof maybeUrl === "string" && maybeUrl.trim()) {
          return maybeUrl;
        }
      }
    }

    const values = Array.isArray(item)
      ? item
      : Object.values(item as Record<string, unknown>);
    stack.push(...values);
  }

  return null;
}

function getCars24DetailPath(rawJson: any) {
  if (typeof rawJson?.cdpRelativeUrl === "string") {
    return rawJson.cdpRelativeUrl;
  }

  const viewDetailsCta = Array.isArray(rawJson?.cta)
    ? rawJson.cta.find((cta: any) => cta?.key === "VIEW_DETAILS")
    : null;

  const ctaUrl = viewDetailsCta?.redirection?.data?.url;
  return typeof ctaUrl === "string" ? ctaUrl : null;
}

function getDetailUrl(row: any) {
  const source = row.source as "cars24" | "spinny";

  if (source === "spinny") {
    return normalizeDetailUrl(source, row.raw_json?.permanent_url);
  }

  return normalizeDetailUrl(
    source,
    getCars24DetailPath(row.raw_json) ??
    findUrlByKeys(row.raw_json, [
      "detailUrl",
      "listingUrl",
      "carUrl",
      "shareUrl",
      "canonicalUrl",
      "seoUrl",
      "path",
    ])
  );
}

function transformCars(data: any[]) {
  const cars =
    (data ?? []).map((row: any) => {
      const originalPrice = Number(row.latest_price ?? 0);
      const adjustedPrice = getAdjustedPrice(row.source, originalPrice);

      return {
        id: row.id,
        externalId: row.external_id,
        source: row.source,
        brand: getBrand(row),
        carName: getCarName(row),
        variant: row.variant ?? row.raw_json?.variant ?? "",
        kmDriven: getKmDriven(row),
        modelYear: getModelYear(row),
        coverImage: getCoverImage(row),
        price: adjustedPrice,
        originalPrice,
        location: getLocation(row),
        booked: getBooked(row),
        detailUrl: getDetailUrl(row),
      } satisfies CarCard;
    })
    .sort((a, b) => a.price - b.price);

  return cars
}

export async function getCars(): Promise<CarCard[]> {
  const { data, error } = await supabase
    .from("cars")
    .select("id, source, external_id, make, model, variant, year, city, odometer_km, latest_price, raw_json")
    .eq("is_active", true);

  if (error) throw error;

  return transformCars(data ?? []);
}

// Absolute URL of the standalone Vercel project hosting api/live-listings.ts.
// Set VITE_LIVE_LISTINGS_API_URL in your Vite app's .env (and in Vercel's
// env vars for prod builds). Falls back to a relative path in case you ever
// proxy/rewrite it to the same origin.
const LIVE_LISTINGS_API_URL =
  import.meta.env.VITE_LIVE_LISTINGS_API_URL ?? "/api/live-listings";

export async function getLiveCars(existingCars: CarCard[]): Promise<CarCard[]> {
  const response = await fetch(LIVE_LISTINGS_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ existingCars }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? `Live listings request failed: ${response.status}`);
  }

  const data = await response.json();
  return transformCars(data ?? []);
}