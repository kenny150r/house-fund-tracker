// Monthly net-worth / home-affordability projection engine.
//
// Modeling choices (documented so the numbers are explainable):
//  - Wages (salary + nurse base + shifts) grow at `salary_growth_pct` annually.
//    Take-home uses the household effective ordinary tax rate at that income.
//  - Net monthly savings (take-home - expenses + extra contribution) flow into a
//    liquid "fund". If `reinvest_savings` is on, the fund grows at the QQQ rate;
//    otherwise it stays as cash.
//  - Existing brokerage holdings grow at each ticker's CAGR. Cash holdings stay flat.
//  - RSU tranches vest into an "vested equity" pool valued at the projected AMZN
//    price, net of the marginal ordinary tax rate (sell-to-cover assumption).
//  - Zoox option tranches vest into the pool at intrinsic value
//    (projected FMV - strike) net of marginal ordinary tax.
//  - The pool keeps growing at the relevant ticker's CAGR after vesting.
//  - "Liquid for down payment" = fund + brokerage (net of ~15% cap-gains on gains)
//    + vested equity pool. Affordability requires liquid >= down payment + closing
//    costs AND PITI <= dti_max * gross monthly income.

import { estimateAnnualTax } from "./tax";
import { computePiti } from "./mortgage";
import { buildVestSchedule } from "./vesting";
import { toMonthly } from "./format";
import type { DataSnapshot, ScenarioOverrides, EquityGrant } from "./types";

export interface MonthPoint {
  date: string;
  monthIndex: number;
  fund: number;
  brokerage: number;
  vestedEquity: number;
  homeEquity: number; // current home value (appreciated) minus mortgage balance
  unvestedEquity: number; // after-tax remaining unvested value
  vestedNetWorth: number;
  unvestedNetWorth: number;
  totalNetWorth: number;
  liquid: number;
  requiredCash: number;
  affordable: boolean;
}

export interface ProjectionResult {
  points: MonthPoint[];
  affordableDate: string | null;
  affordableMonthIndex: number | null;
  requiredCash: number;
  monthlyPiti: number;
  grossMonthlyIncome: number; // wages + equity (used for DTI)
  wageMonthlyIncome: number;
  equityMonthlyIncome: number; // forward-12mo gross vesting / 12
  dtiPasses: boolean;
  dtiRatio: number;
  startingVestedNetWorth: number;
  startingUnvestedNetWorth: number;
  startingLiquid: number;
}

const CAP_GAINS_DRAG = 0.15; // simple blended rate applied to brokerage gains

function annualGrowthToMonthly(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function effGrowth(base: number, scenario: ScenarioOverrides): number {
  return base + scenario.growthAdjustPct;
}

interface TrancheRuntime {
  monthIndex: number; // months from start (can be negative if already vested)
  units: number;
  grant: EquityGrant;
}

export function runProjection(
  snapshot: DataSnapshot,
  scenario: ScenarioOverrides,
  startDate: Date = new Date(),
): ProjectionResult {
  const a = snapshot.assumptions;
  const months = Math.max(1, Math.round(a.projection_years * 12));

  const targetPrice = scenario.targetHousePrice ?? a.target_house_price;
  const downPct = scenario.downPaymentPct ?? a.down_payment_pct;
  const requiredCash = targetPrice * downPct + targetPrice * a.closing_cost_pct;

  // ---- Forecast band: a single Low/Mid/High selector that picks the low,
  // midpoint, or high growth assumption for every driver (and the ZAR forecast).
  const band = scenario.band ?? a.forecast_band ?? "mid";
  const pick = (low: number, mid: number, high: number): number =>
    band === "low" ? low : band === "high" ? high : mid;

  // ---- Income (annual, grown each year) ----
  const wageGrowthMonthly = annualGrowthToMonthly(
    pick(a.salary_growth_low_pct, a.salary_growth_pct, a.salary_growth_high_pct),
  );

  // Per-owner baseline gross annual wages, including baseline shifts + scenario
  // extra shifts (applied to shift-type sources).
  const baseWagesByOwner = { you: 0, spouse: 0, joint: 0 } as Record<string, number>;
  let shiftAnnualFromExtra = 0;
  for (const inc of snapshot.income) {
    let annual = inc.annual_amount;
    if (inc.type === "shift") {
      annual += inc.shift_rate * inc.shifts_per_month * 12;
      shiftAnnualFromExtra +=
        inc.shift_rate * scenario.extraShiftsPerMonth * 12;
    }
    baseWagesByOwner[inc.owner] = (baseWagesByOwner[inc.owner] ?? 0) + annual;
  }
  // Extra shifts attributed to the spouse owner by convention (nurse).
  baseWagesByOwner.spouse += shiftAnnualFromExtra;

  const baseAnnualGross =
    baseWagesByOwner.you + baseWagesByOwner.spouse + baseWagesByOwner.joint;

  // ---- Expenses (monthly, inflated) ----
  const inflationMonthly = annualGrowthToMonthly(a.inflation_pct);
  let baseMonthlyExpenses = 0;
  for (const e of snapshot.expenses) {
    if (!e.active) continue;
    if (scenario.rentOverride != null && /rent/i.test(e.name)) {
      baseMonthlyExpenses += scenario.rentOverride;
    } else {
      baseMonthlyExpenses += toMonthly(e.amount, e.cadence);
    }
  }
  baseMonthlyExpenses *= 1 + scenario.expenseDeltaPct;

  // ---- Holdings ----
  let cashHoldings = 0;
  const tickerShares: Record<string, number> = {};
  const tickerBasis: Record<string, number> = {};
  for (const h of snapshot.holdings) {
    if (h.account_type === "cash" || h.ticker.toUpperCase() === "CASH") {
      cashHoldings += h.shares;
    } else {
      tickerShares[h.ticker] = (tickerShares[h.ticker] ?? 0) + h.shares;
      tickerBasis[h.ticker] = (tickerBasis[h.ticker] ?? 0) + h.cost_basis;
    }
  }

  const growthByTicker: Record<string, number> = {
    QQQ: effGrowth(pick(a.growth_qqq_low_pct, a.growth_qqq_pct, a.growth_qqq_high_pct), scenario),
    AMZN: effGrowth(pick(a.growth_amzn_low_pct, a.growth_amzn_pct, a.growth_amzn_high_pct), scenario),
  };
  function tickerMonthlyGrowth(t: string): number {
    return annualGrowthToMonthly(growthByTicker[t] ?? a.growth_qqq_pct);
  }

  // ---- Equity grant tranches relative to start ----
  const amznGrowthMonthly = annualGrowthToMonthly(
    effGrowth(pick(a.growth_amzn_low_pct, a.growth_amzn_pct, a.growth_amzn_high_pct), scenario),
  );
  const zooxGrowthMonthly = annualGrowthToMonthly(
    effGrowth(a.growth_zoox_pct, scenario),
  );
  const tranches: TrancheRuntime[] = [];
  for (const g of snapshot.grants) {
    for (const ev of buildVestSchedule(g)) {
      const mi = monthsBetween(startDate, ev.date);
      tranches.push({ monthIndex: mi, units: ev.units, grant: g });
    }
  }

  const amznPrice0 = snapshot.prices.AMZN ?? 0;
  const zooxFmv0 = a.zoox_fmv_per_share;

  // Zoox ZAR price path: if a low/high forecast exists, interpolate the selected
  // band (the unified forecast band); otherwise fall back to flat % growth.
  const zooxForecast = (a.zoox_fmv_forecast ?? [])
    .filter((p) => p && p.year > 0)
    .sort((x, y) => x.year - y.year);

  function bandVal(p: { low: number; high: number }): number {
    if (band === "low") return p.low;
    if (band === "high") return p.high;
    return (p.low + p.high) / 2;
  }

  function zooxFmvAt(monthIndex: number): number {
    const m = Math.max(0, monthIndex);
    if (zooxForecast.length > 0) {
      const yearF = m / 12;
      const pts = [{ year: 0, low: zooxFmv0, high: zooxFmv0 }, ...zooxForecast];
      const last = pts[pts.length - 1];
      if (yearF >= last.year) return bandVal(last); // hold flat beyond forecast
      for (let i = 0; i < pts.length - 1; i++) {
        const lo = pts[i];
        const hi = pts[i + 1];
        if (yearF >= lo.year && yearF <= hi.year) {
          const span = hi.year - lo.year || 1;
          const f = (yearF - lo.year) / span;
          return bandVal(lo) + (bandVal(hi) - bandVal(lo)) * f;
        }
      }
      return bandVal(pts[0]);
    }
    return zooxFmv0 * Math.pow(1 + zooxGrowthMonthly, m);
  }

  // Value of a tranche at its vest month (gross + after-tax), valued at the
  // projected price for that month.
  function trancheValueAtVest(t: TrancheRuntime, monthIndex: number, marginal: number) {
    let gross = 0;
    if (t.grant.type === "amazon_rsu") {
      const price = amznPrice0 * Math.pow(1 + amznGrowthMonthly, Math.max(0, monthIndex));
      gross = t.units * price;
    } else {
      const fmv = zooxFmvAt(monthIndex);
      const intrinsic = Math.max(0, fmv - (t.grant.strike_price ?? 0));
      gross = t.units * intrinsic;
    }
    return { gross, afterTax: gross * (1 - marginal) };
  }

  // Effective + marginal tax at the baseline income level (used throughout).
  const baseTax = estimateAnnualTax({
    filing: a.filing_status,
    wagesByOwner: [baseWagesByOwner.you, baseWagesByOwner.spouse + baseWagesByOwner.joint],
    supplementalOrdinary: 0,
    longTermGains: 0,
  });

  // ---- Starting balances ----
  let fund = cashHoldings;
  const liveTickerValue = (atMonth: number) => {
    let total = 0;
    for (const t of Object.keys(tickerShares)) {
      const price0 = snapshot.prices[t] ?? 0;
      const price = price0 * Math.pow(1 + tickerMonthlyGrowth(t), atMonth);
      total += tickerShares[t] * price;
    }
    return total;
  };
  const liveTickerBasis = Object.values(tickerBasis).reduce((s, v) => s + v, 0);

  // Vested equity pool (already-vested grants as of start), valued today and
  // grown forward. Stored as after-tax dollars plus a growth ticker tag.
  let amznPool = 0; // after-tax $ from vested RSUs, grows at AMZN rate
  let zooxPool = 0; // after-tax $ from vested options, grows at Zoox rate
  for (const t of tranches) {
    if (t.monthIndex <= 0) {
      const { afterTax } = trancheValueAtVest(t, 0, baseTax.marginalOrdinaryRate);
      if (t.grant.type === "amazon_rsu") amznPool += afterTax;
      else zooxPool += afterTax;
    }
  }

  // Current ("starter") home: equity counts toward net worth; if you'll sell it
  // to buy the next place, the net sale proceeds count toward the liquid fund.
  const homeValue0 = a.current_home_value;
  const homeBalance = a.current_mortgage_balance;
  const homeApprecMonthly = annualGrowthToMonthly(a.home_appreciation_pct);
  const homeSaleCostPct = a.home_sale_cost_pct;
  const sellHome = a.sell_home_for_down_payment;

  const points: MonthPoint[] = [];
  let affordableMonthIndex: number | null = null;
  const fundGrowthMonthly = a.reinvest_savings
    ? annualGrowthToMonthly(effGrowth(a.growth_qqq_pct, scenario))
    : 0;

  for (let m = 0; m <= months; m++) {
    // Grow pools (after the first month). The Zoox pool tracks the forecast
    // price path month-over-month rather than a flat rate.
    if (m > 0) {
      amznPool *= 1 + amznGrowthMonthly;
      const prevFmv = zooxFmvAt(m - 1);
      zooxPool *= prevFmv > 0 ? zooxFmvAt(m) / prevFmv : 1;
      fund *= 1 + fundGrowthMonthly;
    }

    // Annual wage growth applied monthly.
    const wageFactor = Math.pow(1 + wageGrowthMonthly, m);
    const grossMonthlyWages = (baseAnnualGross / 12) * wageFactor;
    const monthlyExpenses = baseMonthlyExpenses * Math.pow(1 + inflationMonthly, m);

    // Take-home using baseline effective rate (kept stable for clarity).
    const takeHomeMonthly = grossMonthlyWages * (1 - baseTax.effectiveRate);
    const netSavings = takeHomeMonthly - monthlyExpenses + scenario.extraMonthlyContribution;
    if (m > 0) fund += netSavings;

    // Vesting events that land exactly in this month.
    for (const t of tranches) {
      if (t.monthIndex === m && m > 0) {
        const { afterTax } = trancheValueAtVest(t, m, baseTax.marginalOrdinaryRate);
        if (t.grant.type === "amazon_rsu") amznPool += afterTax;
        else zooxPool += afterTax;
      }
    }

    const brokerage = liveTickerValue(m);
    const vestedEquity = amznPool + zooxPool;

    // Remaining unvested grants' after-tax value as of this month.
    let unvestedEquity = 0;
    for (const t of tranches) {
      if (t.monthIndex > m) {
        const { afterTax } = trancheValueAtVest(t, t.monthIndex, baseTax.marginalOrdinaryRate);
        unvestedEquity += afterTax;
      }
    }

    const brokerageGain = Math.max(0, brokerage - liveTickerBasis);
    const brokerageLiquid = brokerage - brokerageGain * CAP_GAINS_DRAG;

    const homeValue = homeValue0 * Math.pow(1 + homeApprecMonthly, m);
    const homeEquity = Math.max(0, homeValue - homeBalance);
    // Net of selling costs; primary-residence gains assumed within the MFJ
    // capital-gains exclusion, so no tax drag applied here.
    const homeSaleNet = Math.max(0, homeValue * (1 - homeSaleCostPct) - homeBalance);

    const liquid =
      fund + brokerageLiquid + vestedEquity + (sellHome ? homeSaleNet : 0);

    const vestedNetWorth = fund + brokerage + vestedEquity + homeEquity;
    const unvestedNetWorth = vestedNetWorth + unvestedEquity;

    const affordable = liquid >= requiredCash;
    if (affordable && affordableMonthIndex === null && m > 0) {
      affordableMonthIndex = m;
    }

    const date = addMonthsDate(startDate, m);
    points.push({
      date: date.toISOString(),
      monthIndex: m,
      fund,
      brokerage,
      vestedEquity,
      homeEquity,
      unvestedEquity,
      vestedNetWorth,
      unvestedNetWorth,
      totalNetWorth: unvestedNetWorth,
      liquid,
      requiredCash,
      affordable,
    });
  }

  // DTI check at target price using current/override mortgage rate.
  const rate = a.mortgage_rate_override ?? snapshot.mortgageRate;
  const piti = computePiti({
    housePrice: targetPrice,
    downPaymentPct: downPct,
    annualRatePct: rate,
    propertyTaxRatePct: a.property_tax_rate,
    homeInsuranceAnnual: a.home_insurance_annual,
    hoaMonthly: a.hoa_monthly,
  });
  // Gross equity income expected over the next 12 months (RSU/ZAR vesting),
  // counted toward DTI since refreshers are expected to continue. Uses gross
  // (pre-tax) value to match how lenders evaluate qualifying income.
  let equityAnnualGross = 0;
  for (const t of tranches) {
    if (t.monthIndex >= 1 && t.monthIndex <= 12) {
      equityAnnualGross += trancheValueAtVest(
        t,
        t.monthIndex,
        baseTax.marginalOrdinaryRate,
      ).gross;
    }
  }
  const wageMonthlyIncome = baseAnnualGross / 12;
  const equityMonthlyIncome = equityAnnualGross / 12;
  const grossMonthlyIncome = wageMonthlyIncome + equityMonthlyIncome;
  const dtiRatio = grossMonthlyIncome > 0 ? piti.total / grossMonthlyIncome : Infinity;
  const dtiPasses = dtiRatio <= a.dti_max_pct;

  const start = points[0];
  return {
    points,
    affordableMonthIndex,
    affordableDate:
      affordableMonthIndex != null ? points[affordableMonthIndex].date : null,
    requiredCash,
    monthlyPiti: piti.total,
    grossMonthlyIncome,
    wageMonthlyIncome,
    equityMonthlyIncome,
    dtiPasses,
    dtiRatio,
    startingVestedNetWorth: start.vestedNetWorth,
    startingUnvestedNetWorth: start.unvestedNetWorth,
    startingLiquid: start.liquid,
  };
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

function addMonthsDate(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
