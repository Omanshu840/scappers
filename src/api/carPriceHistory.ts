import { supabase } from "../lib/supabase";

export type PriceHistoryPoint = {
  date: string; // scraped_date, YYYY-MM-DD
  price: number;
  isActive: boolean;
};

export async function getCarPriceHistory(carId: string): Promise<PriceHistoryPoint[]> {
  const { data, error } = await supabase
    .from("car_price_history")
    .select("scraped_date, price, is_active")
    .eq("car_id", carId)
    .order("scraped_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    date: row.scraped_date,
    price: Number(row.price),
    isActive: Boolean(row.is_active),
  }));
}