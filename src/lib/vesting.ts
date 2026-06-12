import type { EquityGrant } from "./types";

export interface VestEvent {
  date: Date;
  units: number;
  cumulativeUnits: number;
}

// Build the full vest schedule for a grant: a cliff at `cliff_months`, then
// even tranches every `period_months` until `duration_months` is reached.
export function buildVestSchedule(grant: EquityGrant): VestEvent[] {
  const start = new Date(grant.grant_date);
  if (isNaN(start.getTime()) || grant.total_units <= 0) return [];

  const cliff = Math.max(0, grant.cliff_months);
  const period = Math.max(1, grant.period_months);
  const duration = Math.max(cliff, grant.duration_months);

  // Vest dates: first at the cliff, then every `period` months through duration.
  const months: number[] = [];
  if (cliff > 0) months.push(cliff);
  for (let m = cliff > 0 ? cliff + period : period; m <= duration; m += period) {
    months.push(m);
  }
  if (months.length === 0) months.push(duration);

  const perTranche = grant.total_units / months.length;
  let cumulative = 0;
  return months.map((m) => {
    cumulative += perTranche;
    return {
      date: addMonths(start, m),
      units: perTranche,
      cumulativeUnits: cumulative,
    };
  });
}

export interface VestStatus {
  vestedUnits: number;
  unvestedUnits: number;
  nextVest: VestEvent | null;
}

export function vestStatus(grant: EquityGrant, asOf: Date = new Date()): VestStatus {
  const schedule = buildVestSchedule(grant);
  let vested = 0;
  let next: VestEvent | null = null;
  for (const e of schedule) {
    if (e.date <= asOf) {
      vested += e.units;
    } else if (!next) {
      next = e;
    }
  }
  return {
    vestedUnits: vested,
    unvestedUnits: Math.max(0, grant.total_units - vested),
    nextVest: next,
  };
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
