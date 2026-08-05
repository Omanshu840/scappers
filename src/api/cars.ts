import { supabase } from "../lib/supabase";
import {
  getAdjustedPrice,
  getBodyType,
  getBooked,
  getBrand,
  getCarName,
  getCoverImage,
  getDetailUrl,
  getKmDriven,
  getLocation,
  getModelYear,
  type BodyType,
} from "../lib/carDisplay";

export type CarCard = {
  id: string;
  externalId: string;
  source: "cars24" | "spinny";
  brand: string;
  carName: string;
  variant: string;
  bodyType: BodyType | null;
  kmDriven: number | null;
  modelYear: number | null;
  coverImage: string | null;
  price: number;         // adjusted final price
  originalPrice: number;  // price from source table
  location: string | null;
  booked: boolean;
  detailUrl: string | null;
  notes: string | null;
};

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
        bodyType: getBodyType(row),
        kmDriven: getKmDriven(row),
        modelYear: getModelYear(row),
        coverImage: getCoverImage(row),
        price: adjustedPrice,
        originalPrice,
        location: getLocation(row),
        booked: getBooked(row),
        detailUrl: getDetailUrl(row),
        notes: row.notes ?? null,
      } satisfies CarCard;
    })
    .sort((a, b) => a.price - b.price);

  return cars
}

export async function getCars(): Promise<CarCard[]> {
  const { data, error } = await supabase
    .from("cars")
    .select("id, source, external_id, make, model, variant, year, city, odometer_km, latest_price, raw_json, notes")
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