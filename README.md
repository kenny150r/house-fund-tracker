# House Fund Tracker

A private web app that projects when you can afford a house, modeling vested and
unvested equity (Zoox options + Amazon RSUs), brokerage holdings (QQQ/AMZN),
income (salary + variable nursing shifts), expenses, California + federal taxes,
and live stock/mortgage data.

- **Frontend:** React + Vite + TypeScript + Tailwind + Recharts (static SPA)
- **Backend:** Supabase (Auth + Postgres with Row-Level Security + Edge Function)
- **Hosting:** GitHub Pages (public code, but all data is gated by login + RLS)

> Projections are estimates for planning only — not financial or tax advice.

## How it works

```
Browser (you + your partner)
  -> GitHub Pages (React SPA, no secrets)
  -> Supabase Auth (login)
  -> Supabase Postgres (household-scoped data, RLS)
  -> Supabase Edge Function "market-data" (proxies Finnhub + FRED, caches)
```

GitHub Pages can only serve static files, so API keys never live in the repo.
The `market-data` edge function holds the Finnhub/FRED keys as secrets and is the
only thing that talks to those APIs. The Supabase publishable (anon) key is safe
to ship because every table is protected by Row-Level Security.

## Project structure

- `src/lib/` — domain logic: `tax.ts`, `vesting.ts`, `mortgage.ts`, `projection.ts`
- `src/context/` — `AuthContext` and `DataContext` (loads household data + market data)
- `src/pages/` — Dashboard, Holdings, Grants, Income, Expenses, Scenarios, Settings
- `supabase/migrations/` — database schema + RLS
- `supabase/functions/market-data/` — live data proxy edge function
- `.github/workflows/deploy.yml` — build + deploy to GitHub Pages

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example and fill in your Supabase project values
   (Project Settings -> API):

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<publishable anon key>"
```

3. Run the dev server:

```bash
npm run dev
```

4. Sign up, create a household, and (optionally) click "Load starter data" on the
   dashboard to populate realistic editable numbers.

## Live market data (optional but recommended)

The `market-data` edge function is already deployed. To enable live quotes and
mortgage rates, add two free API keys as Supabase secrets:

- **Finnhub** (stock quotes): https://finnhub.io/ — free API key
- **FRED** (30-yr mortgage rate, series `MORTGAGE30US`): https://fred.stlouisfed.org/docs/api/api_key.html

```bash
supabase link --project-ref <project-ref>
supabase secrets set FINNHUB_API_KEY=xxxx FRED_API_KEY=yyyy
```

Without keys, the app falls back to cached/estimated values and clearly labels
them as "estimated". Use the "Refresh market data" link in the sidebar to refetch.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo: Settings -> Pages -> Build and deployment -> Source = **GitHub Actions**.
3. In the repo: Settings -> Secrets and variables -> Actions -> **Variables** tab,
   add two repository variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main`. The workflow builds with the correct base path
   (`/<repo>/` for project pages, `/` for `<user>.github.io`) and publishes `dist/`.

> These are public, RLS-protected values, so storing them as repository
> *variables* (not secrets) is fine. Never put the Supabase service-role key or
> the Finnhub/FRED keys in the repo — those live only as Supabase edge secrets.

## Inviting your partner

On the **Settings** page, copy your Household ID and share it. Your partner signs
up, chooses "Join partner's" during onboarding, and pastes the ID. You then share
the same holdings, grants, income, expenses, and projections.

## Modeling notes

- **Zoox** is private, so its option value uses a manual FMV per share (set in
  Settings, with an optional per-grant override). Value = `(FMV - strike) x units`.
- **Amazon RSUs** vest quarterly and are valued at the live AMZN price; vesting is
  taxed as ordinary income (sell-to-cover assumption).
- **Taxes** include federal MFJ brackets, CA brackets + the 1% MHS surcharge,
  FICA (with the Social Security cap per earner), additional Medicare, and NIIT.
  CA taxes capital gains as ordinary income.
- **Affordability** = first month liquid assets cover down payment + closing
  costs *and* the estimated monthly payment (PITI) passes your max DTI.
