export type CarSource = "cars24" | "spinny";

export function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

export function normalizeDetailUrl(
  source: CarSource,
  url: string | null | undefined
) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const host = source === "spinny" ? "https://www.spinny.com" : "https://www.cars24.com";
  return url.startsWith("/") ? `${host}${url}` : `${host}/${url}`;
}

export function getAdjustedPrice(source: CarSource, price: number) {
  return source === "cars24" ? price + 50000 : price;
}

export function getCoverImage(row: any) {
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

export function getLocation(row: any) {
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

export function getBrand(row: any) {
  return row.make ?? row.raw_json?.make ?? "";
}

export function getCarName(row: any) {
  if (row.source === "cars24") {
    return row.raw_json?.carName ?? `${row.make ?? ""} ${row.model ?? ""}`.trim();
  }

  return `${row.make ?? ""} ${row.model ?? ""}`.trim();
}

export function getKmDriven(row: any) {
  return row.odometer_km ?? row.raw_json?.odometer?.value ?? row.raw_json?.mileage ?? null;
}

export function getModelYear(row: any) {
  return row.year ?? row.raw_json?.make_year ?? row.raw_json?.registration_year ?? null;
}

export function getBooked(row: any) {
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

export function getDetailUrl(row: any) {
  const source = row.source as CarSource;

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