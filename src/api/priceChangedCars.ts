import { supabase } from "../lib/supabase";
import {
  getAdjustedPrice,
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
  priceChange: number;        // latest_price - previous_price (adjustment cancels out, so raw delta is correct as-is)
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
      } satisfies PriceChangeCarCard;
    })
    // biggest movers first, within whichever section (active/inactive) consumes this
    .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
}

export async function getCarsWithPriceChanges(): Promise<PriceChangeCarCard[]> {
  const { data, error } = await supabase
    .from("cars_with_price_change")
    .select(
      "id, source, external_id, last_seen_at, is_active, make, model, variant, year, city, odometer_km, latest_price, raw_json, previous_price, price_change, previous_price_date"
    )
    // only cars that actually have a prior price to compare against, and
    // whose price actually moved (exclude 0, not just null)
    .not("price_change", "is", null)
    .neq("price_change", 0);

  if (error) throw error;

  return transformPriceChangeCars(data ?? []);
}