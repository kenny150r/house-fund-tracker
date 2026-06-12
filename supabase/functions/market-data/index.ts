// market-data edge function
//
// Proxies live market data so API keys never reach the public web bundle:
//  - Stock quotes from Finnhub (FINNHUB_API_KEY)
//  - 30-year fixed mortgage rate from FRED series MORTGAGE30US (FRED_API_KEY)
//
// Results are cached in public.market_cache (written with the service role) to
// stay within free-tier rate limits. If a key is missing or a fetch fails, the
// function returns the last cached value and flags the response as stale.
//
// Set secrets with the Supabase CLI:
//   supabase secrets set FINNHUB_API_KEY=xxx FRED_API_KEY=yyy --project-ref <ref>

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const QUOTE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MORTGAGE_KEY = "MORTGAGE30US";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface CacheRow {
  ticker: string;
  price: number;
  as_of: string;
  source: string;
}

async function readCache(): Promise<Map<string, CacheRow>> {
  const { data } = await supabase.from("market_cache").select("*");
  const map = new Map<string, CacheRow>();
  for (const row of (data ?? []) as CacheRow[]) map.set(row.ticker, row);
  return map;
}

function isFresh(row: CacheRow | undefined, ttl: number): boolean {
  if (!row) return false;
  return Date.now() - new Date(row.as_of).getTime() < ttl;
}

async function upsert(ticker: string, price: number, source: string) {
  await supabase
    .from("market_cache")
    .upsert({ ticker, price, source, as_of: new Date().toISOString() });
}

async function fetchQuote(ticker: string, key: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = Number(json.c);
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function fetchMortgageRate(key: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${key}&file_type=json&sort_order=desc&limit=1`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const value = Number(json?.observations?.[0]?.value);
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let tickers: string[] = ["QQQ", "AMZN"];
  try {
    const body = await req.json();
    if (Array.isArray(body?.tickers) && body.tickers.length) {
      tickers = body.tickers.map((t: string) => String(t).toUpperCase());
    }
  } catch {
    // use defaults
  }

  const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
  const fredKey = Deno.env.get("FRED_API_KEY");
  const cache = await readCache();

  let stale = false;
  const quotes: Record<string, number> = {};
  let oldest = Date.now();

  for (const ticker of tickers) {
    const cached = cache.get(ticker);
    if (isFresh(cached, QUOTE_TTL_MS)) {
      quotes[ticker] = cached!.price;
      oldest = Math.min(oldest, new Date(cached!.as_of).getTime());
      continue;
    }
    const fresh = finnhubKey ? await fetchQuote(ticker, finnhubKey) : null;
    if (fresh != null) {
      quotes[ticker] = fresh;
      await upsert(ticker, fresh, "finnhub");
    } else if (cached) {
      quotes[ticker] = cached.price;
      stale = true;
      oldest = Math.min(oldest, new Date(cached.as_of).getTime());
    } else {
      stale = true;
    }
  }

  // Mortgage rate.
  let mortgageRate: number | null = null;
  const cachedRate = cache.get(MORTGAGE_KEY);
  if (isFresh(cachedRate, RATE_TTL_MS)) {
    mortgageRate = cachedRate!.price;
  } else {
    const fresh = fredKey ? await fetchMortgageRate(fredKey) : null;
    if (fresh != null) {
      mortgageRate = fresh;
      await upsert(MORTGAGE_KEY, fresh, "fred");
    } else if (cachedRate) {
      mortgageRate = cachedRate.price;
      stale = true;
    } else {
      mortgageRate = 6.8;
      stale = true;
    }
  }

  return new Response(
    JSON.stringify({
      quotes,
      mortgageRate,
      asOf: new Date(oldest).toISOString(),
      stale,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
