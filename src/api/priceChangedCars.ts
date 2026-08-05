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
} from "../lib/carDisplay";
import type { CarCard } from "./cars";

export type PriceChangeCarCard = CarCard & {
  isActive: boolean;
  previousPrice: number;      // adjusted, same basis as `price`
  priceChange: number;        // latest_price - previous_price (0 if no history / no movement)
  previousPriceDate: string | null;
  lastSeenAt: string;
};

function transformPriceChangeCars(data: any[]): PriceChangeCarCard[] {
  return (data ?? [])
    .map((row: any) => {
      const originalPrice = Number(row.latest_price ?? 0);
      const adjustedPrice = getAdjustedPrice(row.source, originalPrice);
      const previousPrice = getAdjustedPrice(row.source, Number(row.previous_price ?? 0));

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
        isActive: Boolean(row.is_active),
        previousPrice,
        priceChange: Number(row.price_change ?? 0),
        previousPriceDate: row.previous_price_date ?? null,
        lastSeenAt: row.last_seen_at,
        notes: row.notes ?? null,
      } satisfies PriceChangeCarCard;
    })
    // biggest movers first; cars with no change at all naturally sort last
    .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
}

const VIEW_COLUMNS =
  "id, source, external_id, last_seen_at, is_active, make, model, variant, year, city, odometer_km, latest_price, raw_json, notes, previous_price, price_change, previous_price_date";

async function fetchCarsWithPriceChangeView(onlyChanged: boolean): Promise<PriceChangeCarCard[]> {
  let query = supabase.from("cars_with_price_change").select(VIEW_COLUMNS);

  if (onlyChanged) {
    // only cars that have a prior price to compare against, and whose
    // price actually moved (exclude 0, not just null)
    query = query.not("price_change", "is", null).neq("price_change", 0);
  }

  const { data, error } = await query;
  if (error) throw error;

  return transformPriceChangeCars(data ?? []);
}

/** Cars (active or inactive) whose price has actually moved. */
export async function getCarsWithPriceChanges(): Promise<PriceChangeCarCard[]> {
  return fetchCarsWithPriceChangeView(true);
}

/**
 * Every car — active and inactive — each annotated with price-change info
 * (priceChange is 0 when there's no recorded movement). This is the single
 * source of truth for the merged listings screen.
 */
export async function getAllCarsWithPriceInfo(): Promise<PriceChangeCarCard[]> {
  return fetchCarsWithPriceChangeView(false);
}