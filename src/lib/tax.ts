// Simplified household tax estimator for California (MFJ-focused).
//
// IMPORTANT: this is an estimate to drive planning projections, not tax advice.
// It models federal + CA income tax, FICA (SS + Medicare + additional Medicare),
// and NIIT. RSU vesting and non-qualified option spreads are treated as ordinary
// supplemental income. California taxes long-term capital gains as ordinary
// income, which is reflected here.

import type { FilingStatus } from "./types";

interface Bracket {
  upTo: number; // upper bound of this bracket (Infinity for top)
  rate: number;
}

// 2025 federal ordinary-income brackets.
const FED_MFJ: Bracket[] = [
  { upTo: 23850, rate: 0.1 },
  { upTo: 96950, rate: 0.12 },
  { upTo: 206700, rate: 0.22 },
  { upTo: 394600, rate: 0.24 },
  { upTo: 501050, rate: 0.32 },
  { upTo: 751600, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];
const FED_SINGLE: Bracket[] = [
  { upTo: 11925, rate: 0.1 },
  { upTo: 48475, rate: 0.12 },
  { upTo: 103350, rate: 0.22 },
  { upTo: 197300, rate: 0.24 },
  { upTo: 250525, rate: 0.32 },
  { upTo: 626350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

// Federal long-term capital gains brackets (taxable income thresholds).
const FED_LTCG_MFJ: Bracket[] = [
  { upTo: 96700, rate: 0.0 },
  { upTo: 600050, rate: 0.15 },
  { upTo: Infinity, rate: 0.2 },
];
const FED_LTCG_SINGLE: Bracket[] = [
  { upTo: 48350, rate: 0.0 },
  { upTo: 533400, rate: 0.15 },
  { upTo: Infinity, rate: 0.2 },
];

// California 2024/2025 brackets (single thresholds; MFJ doubles widths).
const CA_SINGLE: Bracket[] = [
  { upTo: 10756, rate: 0.01 },
  { upTo: 25499, rate: 0.02 },
  { upTo: 40245, rate: 0.04 },
  { upTo: 55866, rate: 0.06 },
  { upTo: 70606, rate: 0.08 },
  { upTo: 360659, rate: 0.093 },
  { upTo: 432787, rate: 0.103 },
  { upTo: 721314, rate: 0.113 },
  { upTo: Infinity, rate: 0.123 },
];

const FED_STD_DEDUCTION = { mfj: 30000, single: 15000 };
const CA_STD_DEDUCTION = { mfj: 11080, single: 5540 };

// FICA constants (2025).
const SS_WAGE_BASE = 176100;
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDL_MEDICARE_RATE = 0.009;
const ADDL_MEDICARE_THRESHOLD = { mfj: 250000, single: 200000 };
const NIIT_RATE = 0.038;
const NIIT_THRESHOLD = { mfj: 250000, single: 200000 };
const CA_MHS_THRESHOLD = 1000000; // mental-health services 1% surcharge
const CA_MHS_RATE = 0.01;

function bracketTax(amount: number, brackets: Bracket[], double = false): number {
  if (amount <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    const upper = b.upTo === Infinity ? Infinity : double ? b.upTo * 2 : b.upTo;
    const taxable = Math.min(amount, upper) - prev;
    if (taxable > 0) tax += taxable * b.rate;
    prev = upper;
    if (amount <= upper) break;
  }
  return tax;
}

export interface TaxInput {
  filing: FilingStatus;
  wagesByOwner: number[]; // gross W-2 wages per earner (for FICA caps)
  supplementalOrdinary: number; // RSU vests + NSO spread + short-term gains
  longTermGains: number;
}

export interface TaxResult {
  ordinaryIncome: number;
  federal: number;
  state: number;
  fica: number;
  niit: number;
  capitalGainsTax: number;
  total: number;
  netIncome: number; // gross - total
  effectiveRate: number;
  marginalOrdinaryRate: number;
}

export function estimateAnnualTax(input: TaxInput): TaxResult {
  const mfj = input.filing === "mfj";
  const key = mfj ? "mfj" : "single";
  const wages = input.wagesByOwner.reduce((a, b) => a + b, 0);
  const grossOrdinary = wages + input.supplementalOrdinary;
  const grossAll = grossOrdinary + input.longTermGains;

  // Federal ordinary income tax.
  const fedTaxable = Math.max(0, grossOrdinary - FED_STD_DEDUCTION[key]);
  const fedBrackets = mfj ? FED_MFJ : FED_SINGLE;
  const federalOrdinary = bracketTax(fedTaxable, fedBrackets);

  // Federal long-term capital gains stack on top of ordinary taxable income.
  const ltcgBrackets = mfj ? FED_LTCG_MFJ : FED_LTCG_SINGLE;
  const capitalGainsTax = stackedLtcg(
    fedTaxable,
    input.longTermGains,
    ltcgBrackets,
    mfj,
  );

  // California taxes all income (incl. cap gains) as ordinary.
  const caTaxable = Math.max(0, grossAll - CA_STD_DEDUCTION[key]);
  let state = bracketTax(caTaxable, CA_SINGLE, mfj);
  if (caTaxable > CA_MHS_THRESHOLD) {
    state += (caTaxable - CA_MHS_THRESHOLD) * CA_MHS_RATE;
  }

  // FICA per earner (Social Security capped individually).
  let fica = 0;
  for (const w of input.wagesByOwner) {
    fica += Math.min(w, SS_WAGE_BASE) * SS_RATE;
    fica += w * MEDICARE_RATE;
  }
  const addlBase = Math.max(0, wages - ADDL_MEDICARE_THRESHOLD[key]);
  fica += addlBase * ADDL_MEDICARE_RATE;

  // NIIT on investment income above MAGI threshold.
  const overThreshold = Math.max(0, grossAll - NIIT_THRESHOLD[key]);
  const niit = Math.min(input.longTermGains, overThreshold) * NIIT_RATE;

  const federal = federalOrdinary + capitalGainsTax;
  const total = federal + state + fica + niit;
  const netIncome = grossAll - total;

  // Marginal rate on the next dollar of ordinary income.
  const marginalOrdinaryRate =
    marginalRate(fedTaxable, fedBrackets) +
    marginalRate(caTaxable, CA_SINGLE, mfj) +
    MEDICARE_RATE +
    (wages > ADDL_MEDICARE_THRESHOLD[key] ? ADDL_MEDICARE_RATE : 0) +
    (wages < SS_WAGE_BASE ? SS_RATE : 0);

  return {
    ordinaryIncome: grossOrdinary,
    federal,
    state,
    fica,
    niit,
    capitalGainsTax,
    total,
    netIncome,
    effectiveRate: grossAll > 0 ? total / grossAll : 0,
    marginalOrdinaryRate,
  };
}

function stackedLtcg(
  ordinaryTaxable: number,
  gains: number,
  brackets: Bracket[],
  double: boolean,
): number {
  if (gains <= 0) return 0;
  let tax = 0;
  let pos = ordinaryTaxable;
  let remaining = gains;
  for (const b of brackets) {
    const upper = b.upTo === Infinity ? Infinity : double ? b.upTo * 2 : b.upTo;
    if (pos >= upper) continue;
    const room = upper - pos;
    const taxed = Math.min(remaining, room);
    tax += taxed * b.rate;
    remaining -= taxed;
    pos += taxed;
    if (remaining <= 0) break;
  }
  return tax;
}

function marginalRate(amount: number, brackets: Bracket[], double = false): number {
  let prev = 0;
  for (const b of brackets) {
    const upper = b.upTo === Infinity ? Infinity : double ? b.upTo * 2 : b.upTo;
    if (amount <= upper) return b.rate;
    prev = upper;
  }
  void prev;
  return brackets[brackets.length - 1].rate;
}
