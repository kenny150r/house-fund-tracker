import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { fetchMarketData } from "../lib/market";
import { useAuth } from "./AuthContext";
import type {
  Assumptions,
  DataSnapshot,
  EquityGrant,
  Expense,
  Holding,
  Household,
  IncomeSource,
  MarketData,
  StockTransaction,
} from "../lib/types";

type TableName =
  | "holdings"
  | "stock_transactions"
  | "equity_grants"
  | "income_sources"
  | "expenses";

interface DataState {
  loading: boolean;
  household: Household | null;
  needsOnboarding: boolean;
  holdings: Holding[];
  transactions: StockTransaction[];
  grants: EquityGrant[];
  income: IncomeSource[];
  expenses: Expense[];
  assumptions: Assumptions | null;
  market: MarketData | null;
  prices: Record<string, number>;
  mortgageRate: number;
  snapshot: DataSnapshot | null;
  refresh: () => Promise<void>;
  refreshMarket: () => Promise<void>;
  createHousehold: (name: string, displayName: string) => Promise<void>;
  insertRow: <T extends object>(table: TableName, row: T) => Promise<void>;
  updateRow: (table: TableName, id: string, patch: object) => Promise<void>;
  deleteRow: (table: TableName, id: string) => Promise<void>;
  saveAssumptions: (patch: Partial<Assumptions>) => Promise<void>;
  seedStarterData: () => Promise<void>;
}

const DataContext = createContext<DataState | undefined>(undefined);

const DEFAULT_ASSUMPTIONS = (household_id: string): Assumptions => ({
  household_id,
  filing_status: "mfj",
  state: "CA",
  target_house_price: 900000,
  down_payment_pct: 0.2,
  closing_cost_pct: 0.03,
  mortgage_rate_override: null,
  property_tax_rate: 1.1,
  home_insurance_annual: 1800,
  hoa_monthly: 0,
  inflation_pct: 3,
  forecast_band: "mid",
  growth_qqq_pct: 8,
  growth_qqq_low_pct: 4,
  growth_qqq_high_pct: 12,
  growth_amzn_pct: 10,
  growth_amzn_low_pct: 5,
  growth_amzn_high_pct: 16,
  growth_zoox_pct: 5,
  salary_growth_pct: 4,
  salary_growth_low_pct: 2,
  salary_growth_high_pct: 6,
  zoox_fmv_per_share: 0,
  zoox_fmv_forecast: null,
  zoox_forecast_band: "mid",
  projection_years: 7,
  dti_max_pct: 0.36,
  reinvest_savings: false,
  current_home_value: 0,
  current_mortgage_balance: 0,
  home_appreciation_pct: 4,
  home_sale_cost_pct: 0.06,
  sell_home_for_down_payment: true,
  updated_at: new Date().toISOString(),
});

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [grants, setGrants] = useState<EquityGrant[]>([]);
  const [income, setIncome] = useState<IncomeSource[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const householdId = household?.id ?? null;
  const marketStarted = useRef(false);

  const loadHousehold = useCallback(async () => {
    if (!user) return null;
    const { data: members } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1);
    const hid = members?.[0]?.household_id;
    if (!hid) {
      setHousehold(null);
      return null;
    }
    const { data: hh } = await supabase
      .from("households")
      .select("*")
      .eq("id", hid)
      .single();
    setHousehold(hh as Household);
    return hh as Household;
  }, [user]);

  const loadAll = useCallback(
    async (hid: string) => {
      const [h, t, g, i, e, asmp] = await Promise.all([
        supabase.from("holdings").select("*").eq("household_id", hid),
        supabase
          .from("stock_transactions")
          .select("*")
          .eq("household_id", hid)
          .order("date", { ascending: false }),
        supabase.from("equity_grants").select("*").eq("household_id", hid),
        supabase.from("income_sources").select("*").eq("household_id", hid),
        supabase.from("expenses").select("*").eq("household_id", hid),
        supabase.from("assumptions").select("*").eq("household_id", hid).maybeSingle(),
      ]);
      setHoldings((h.data as Holding[]) ?? []);
      setTransactions((t.data as StockTransaction[]) ?? []);
      setGrants((g.data as EquityGrant[]) ?? []);
      setIncome((i.data as IncomeSource[]) ?? []);
      setExpenses((e.data as Expense[]) ?? []);
      if (asmp.data) {
        setAssumptions(asmp.data as Assumptions);
      } else {
        const def = DEFAULT_ASSUMPTIONS(hid);
        await supabase.from("assumptions").insert(def);
        setAssumptions(def);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const hh = await loadHousehold();
    if (hh) await loadAll(hh.id);
    setLoading(false);
  }, [loadHousehold, loadAll]);

  const refreshMarket = useCallback(async () => {
    const m = await fetchMarketData();
    setMarket(m);
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
      if (!marketStarted.current) {
        marketStarted.current = true;
        refreshMarket();
      }
    } else {
      setHousehold(null);
      setLoading(false);
    }
  }, [user, refresh, refreshMarket]);

  const createHousehold = useCallback(
    async (name: string, displayName: string) => {
      if (!user) return;
      // Atomic RPC creates the household, membership, and assumptions together.
      // This avoids an RLS chicken-and-egg (you can't read a household back until
      // you're a member of it).
      const { error } = await supabase.rpc("create_household", {
        p_name: name,
        p_display_name: displayName,
      });
      if (error) throw error;
      await refresh();
    },
    [user, refresh],
  );

  const insertRow = useCallback(
    async <T extends object>(table: TableName, row: T) => {
      if (!householdId) return;
      const { error } = await supabase
        .from(table)
        .insert({ ...row, household_id: householdId });
      if (error) throw error;
      await loadAll(householdId);
    },
    [householdId, loadAll],
  );

  const updateRow = useCallback(
    async (table: TableName, id: string, patch: object) => {
      if (!householdId) return;
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) throw error;
      await loadAll(householdId);
    },
    [householdId, loadAll],
  );

  const deleteRow = useCallback(
    async (table: TableName, id: string) => {
      if (!householdId) return;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await loadAll(householdId);
    },
    [householdId, loadAll],
  );

  const saveAssumptions = useCallback(
    async (patch: Partial<Assumptions>) => {
      if (!householdId) return;
      const next = { ...patch, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from("assumptions")
        .update(next)
        .eq("household_id", householdId);
      if (error) throw error;
      setAssumptions((prev) => (prev ? { ...prev, ...next } : prev));
    },
    [householdId],
  );

  const seedStarterData = useCallback(async () => {
    if (!householdId) return;
    await Promise.all([
      supabase.from("holdings").insert([
        { household_id: householdId, ticker: "CASH", shares: 40000, cost_basis: 40000, account_type: "cash" },
        { household_id: householdId, ticker: "QQQ", shares: 120, cost_basis: 42000, account_type: "brokerage" },
        { household_id: householdId, ticker: "AMZN", shares: 150, cost_basis: 24000, account_type: "brokerage" },
      ]),
      supabase.from("income_sources").insert([
        { household_id: householdId, label: "Base salary", owner: "you", type: "salary", annual_amount: 185000 },
        { household_id: householdId, label: "Nursing base", owner: "spouse", type: "shift", annual_amount: 0, shift_rate: 950, shifts_per_month: 12 },
      ]),
      supabase.from("expenses").insert([
        { household_id: householdId, name: "Rent", category: "Housing", amount: 3200, cadence: "monthly" },
        { household_id: householdId, name: "Car insurance", category: "Auto", amount: 220, cadence: "monthly" },
        { household_id: householdId, name: "Car registration", category: "Auto", amount: 480, cadence: "annual" },
        { household_id: householdId, name: "Power", category: "Utilities", amount: 160, cadence: "monthly" },
        { household_id: householdId, name: "Water", category: "Utilities", amount: 70, cadence: "monthly" },
        { household_id: householdId, name: "Trash", category: "Utilities", amount: 45, cadence: "monthly" },
        { household_id: householdId, name: "Dog food", category: "Pets", amount: 90, cadence: "monthly" },
        { household_id: householdId, name: "Car loan", category: "Debt", amount: 540, cadence: "monthly" },
        { household_id: householdId, name: "Gym membership", category: "Fitness", amount: 70, cadence: "monthly" },
        { household_id: householdId, name: "Streaming subscriptions", category: "Subscriptions", amount: 55, cadence: "monthly" },
        { household_id: householdId, name: "Groceries", category: "Food", amount: 900, cadence: "monthly" },
      ]),
    ]);
    await loadAll(householdId);
  }, [householdId, loadAll]);

  const prices = useMemo(() => market?.quotes ?? { QQQ: 0, AMZN: 0 }, [market]);
  const mortgageRate = market?.mortgageRate ?? 6.8;

  const snapshot = useMemo<DataSnapshot | null>(() => {
    if (!assumptions) return null;
    return { holdings, grants, income, expenses, assumptions, prices, mortgageRate };
  }, [holdings, grants, income, expenses, assumptions, prices, mortgageRate]);

  const value = useMemo<DataState>(
    () => ({
      loading,
      household,
      needsOnboarding: !loading && !!user && !household,
      holdings,
      transactions,
      grants,
      income,
      expenses,
      assumptions,
      market,
      prices,
      mortgageRate,
      snapshot,
      refresh,
      refreshMarket,
      createHousehold,
      insertRow,
      updateRow,
      deleteRow,
      saveAssumptions,
      seedStarterData,
    }),
    [
      loading,
      household,
      user,
      holdings,
      transactions,
      grants,
      income,
      expenses,
      assumptions,
      market,
      prices,
      mortgageRate,
      snapshot,
      refresh,
      refreshMarket,
      createHousehold,
      insertRow,
      updateRow,
      deleteRow,
      saveAssumptions,
      seedStarterData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
