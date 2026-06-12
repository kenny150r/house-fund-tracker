export function currency(n: number, maximumFractionDigits = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
}

export function compactCurrency(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function percent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function shares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// One tick timestamp per distinct calendar year, so time-axis labels don't
// repeat the same year across multiple monthly data points.
export function yearTicks(timestamps: number[]): number[] {
  const seen = new Set<number>();
  const ticks: number[] = [];
  for (const t of timestamps) {
    const y = new Date(t).getFullYear();
    if (!seen.has(y)) {
      seen.add(y);
      ticks.push(t);
    }
  }
  return ticks;
}

// Convert an expense to its monthly-equivalent dollar cost.
export function toMonthly(amount: number, cadence: string): number {
  switch (cadence) {
    case "weekly":
      return (amount * 52) / 12;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    case "monthly":
    default:
      return amount;
  }
}
