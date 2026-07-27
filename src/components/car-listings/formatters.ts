export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN").format(value)
}

export function formatCompactINR(value: number) {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} Lakh`
  }

  return formatINR(value)
}

export function formatKilometers(value: number | null) {
  if (value === null) return "N/A"
  if (value >= 1000) return `${Math.round(value / 1000)}K km`

  return `${formatINR(value)} km`
}

export function formatSource(source: string) {
  return source === "cars24" ? "Cars24" : "Spinny"
}

export function getEstimatedEmi(price: number) {
  return Math.round(price / 60)
}
