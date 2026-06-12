// Shared domain types. These mirror the Supabase table columns so the same
// shapes flow from the database through the projection engine to the UI.

export type UUID = string;

export interface Household {
  id: UUID;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: UUID;
  user_id: UUID;
  role: string;
  display_name: string | null;
  created_at: string;
}

export type AccountType = "brokerage" | "cash" | "retirement";

export interface Holding {
  id: UUID;
  household_id: UUID;
  ticker: string; // "QQQ", "AMZN", or "CASH"
  shares: number; // for CASH this is the dollar amount
  cost_basis: number; // total cost basis in dollars
  account_type: AccountType;
  created_at: string;
  updated_at: string;
}

export type TxType = "buy" | "sell";

export interface StockTransaction {
  id: UUID;
  household_id: UUID;
  ticker: string;
  type: TxType;
  shares: number;
  price: number;
  fees: number;
  date: string; // ISO date
  note: string | null;
  created_at: string;
}

export type GrantType = "amazon_rsu" | "zoox_option";

// One tranche of a custom (graded) vesting schedule.
export interface VestTranche {
  month: number; // months from grant date
  fraction: number; // 0..1 portion of total_units vesting at this point
}

export interface EquityGrant {
  id: UUID;
  household_id: UUID;
  label: string;
  type: GrantType;
  grant_date: string; // ISO date
  total_units: number;
  strike_price: number | null; // options / ZAR base price
  fmv_per_share: number | null; // private valuation (Zoox); null => use live ticker
  cliff_months: number; // months until first vest (even-tranche mode)
  period_months: number; // months between vests after cliff (even-tranche mode)
  duration_months: number; // total vesting length (even-tranche mode)
  vest_schedule: VestTranche[] | null; // custom graded schedule (overrides above)
  created_at: string;
}

export type IncomeOwner = "you" | "spouse" | "joint";
export type IncomeType = "salary" | "hourly" | "shift" | "other";

export interface IncomeSource {
  id: UUID;
  household_id: UUID;
  label: string;
  owner: IncomeOwner;
  type: IncomeType;
  annual_amount: number; // baseline gross annual (salary / base wage)
  shift_rate: number; // gross $ per shift (shift type)
  shifts_per_month: number; // baseline shifts/month (shift type)
  created_at: string;
}

export type ExpenseCadence = "weekly" | "monthly" | "quarterly" | "annual";

export interface Expense {
  id: UUID;
  household_id: UUID;
  name: string;
  category: string;
  amount: number;
  cadence: ExpenseCadence;
  active: boolean;
  created_at: string;
}

export type FilingStatus = "mfj" | "single";
export type ForecastBand = "low" | "mid" | "high";

// One point of Zoox's ZAR price forecast (FMV per share).
export interface ZooxForecastPoint {
  year: number; // years from now (year 0 = current FMV)
  low: number;
  high: number;
}

export interface Assumptions {
  household_id: UUID;
  filing_status: FilingStatus;
  state: string;
  target_house_price: number;
  down_payment_pct: number; // 0..1
  closing_cost_pct: number; // 0..1 of price
  mortgage_rate_override: number | null; // annual %, null => live rate
  property_tax_rate: number; // annual % of price
  home_insurance_annual: number;
  hoa_monthly: number;
  inflation_pct: number; // annual % applied to expenses
  growth_qqq_pct: number; // annual %
  growth_amzn_pct: number;
  growth_zoox_pct: number;
  salary_growth_pct: number;
  zoox_fmv_per_share: number; // current private valuation (forecast year 0)
  zoox_fmv_forecast: ZooxForecastPoint[] | null; // low/high band by year
  zoox_forecast_band: ForecastBand; // which band the main projection uses
  projection_years: number;
  dti_max_pct: number; // 0..1 max PITI / gross monthly income
  reinvest_savings: boolean; // savings grow at QQQ rate vs held as cash
  current_home_value: number; // starter home current market value
  current_mortgage_balance: number; // remaining loan balance on the starter home
  home_appreciation_pct: number; // annual % appreciation of the starter home
  home_sale_cost_pct: number; // 0..1 selling costs (agent + closing)
  sell_home_for_down_payment: boolean; // count net sale proceeds toward the fund
  updated_at: string;
}

export interface MarketQuote {
  ticker: string;
  price: number;
  as_of: string;
  source: string;
}

export interface MarketData {
  quotes: Record<string, number>; // ticker -> price
  mortgageRate: number; // annual %
  asOf: string;
  stale: boolean;
}

// Snapshot consumed by the projection engine.
export interface DataSnapshot {
  holdings: Holding[];
  grants: EquityGrant[];
  income: IncomeSource[];
  expenses: Expense[];
  assumptions: Assumptions;
  prices: Record<string, number>;
  mortgageRate: number;
}

// Live "what-if" overrides applied on top of the saved snapshot.
export interface ScenarioOverrides {
  extraShiftsPerMonth: number;
  expenseDeltaPct: number; // -0.2 => cut expenses 20%
  rentOverride: number | null; // monthly; replaces "Rent" expense
  growthAdjustPct: number; // added to every ticker growth assumption
  targetHousePrice: number | null;
  downPaymentPct: number | null;
  extraMonthlyContribution: number; // additional savings/month
  zooxBand: ForecastBand | null; // override the saved ZAR forecast band
}

export const ZERO_SCENARIO: ScenarioOverrides = {
  extraShiftsPerMonth: 0,
  expenseDeltaPct: 0,
  rentOverride: null,
  growthAdjustPct: 0,
  targetHousePrice: null,
  downPaymentPct: null,
  extraMonthlyContribution: 0,
  zooxBand: null,
};
