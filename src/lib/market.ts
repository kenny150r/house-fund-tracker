import { supabase } from "./supabase";
import type { MarketData } from "./types";

const TICKERS = ["QQQ", "AMZN"];

// Fallback values used when the edge function or network is unavailable, so the
// app still renders projections. These are clearly marked "stale" in the UI.
const FALLBACK: MarketData = {
  quotes: { QQQ: 480, AMZN: 200 },
  mortgageRate: 6.8,
  asOf: new Date(0).toISOString(),
  stale: true,
};

// Calls the `market-data` Supabase Edge Function which proxies Finnhub (quotes)
// and FRED (mortgage rate) so API keys never reach the public bundle.
export async function fetchMarketData(): Promise<MarketData> {
  try {
    const { data, error } = await supabase.functions.invoke("market-data", {
      body: { tickers: TICKERS },
    });
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("empty response");
    const quotes: Record<string, number> = data.quotes ?? {};
    return {
      quotes: { ...FALLBACK.quotes, ...quotes },
      mortgageRate: data.mortgageRate ?? FALLBACK.mortgageRate,
      asOf: data.asOf ?? new Date().toISOString(),
      stale: Boolean(data.stale),
    };
  } catch {
    return FALLBACK;
  }
}
