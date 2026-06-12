import { useState } from "react";
import { useData } from "../context/DataContext";
import { PageHeader, Field, EmptyState, StatCard } from "../components/ui";
import { currency, formatDate, shares as fmtShares } from "../lib/format";
import { vestStatus, addMonths } from "../lib/vesting";
import type { GrantType, EquityGrant } from "../lib/types";

const PRESETS: Record<GrantType, { cliff: number; period: number; duration: number }> = {
  amazon_rsu: { cliff: 0, period: 3, duration: 48 }, // quarterly over 4 years
  zoox_option: { cliff: 12, period: 12, duration: 72 }, // 1yr cliff, 6 years
};

// Zoox ZAR graded vesting: 0% yr1, 15% yr2, 20% yrs 3-5, 25% yr6.
const ZOOX_ZAR_PRESET = [
  { month: 24, percent: 15 },
  { month: 36, percent: 20 },
  { month: 48, percent: 20 },
  { month: 60, percent: 20 },
  { month: 72, percent: 25 },
];

interface TrancheInput {
  month: number;
  percent: number;
}

export default function Grants() {
  const { grants, assumptions, prices, insertRow, deleteRow } = useData();
  const [type, setType] = useState<GrantType>("amazon_rsu");
  const [label, setLabel] = useState("");
  const [grantDate, setGrantDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState("");
  const [strike, setStrike] = useState("");
  const [fmv, setFmv] = useState("");
  const [cliff, setCliff] = useState(PRESETS.amazon_rsu.cliff);
  const [period, setPeriod] = useState(PRESETS.amazon_rsu.period);
  const [duration, setDuration] = useState(PRESETS.amazon_rsu.duration);
  const [useCustom, setUseCustom] = useState(false);
  const [tranches, setTranches] = useState<TrancheInput[]>([]);

  const trancheTotal = tranches.reduce((s, t) => s + t.percent, 0);

  function updateTranche(idx: number, key: keyof TrancheInput, val: number) {
    setTranches(tranches.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
  }

  function applyPreset(t: GrantType) {
    setType(t);
    setCliff(PRESETS[t].cliff);
    setPeriod(PRESETS[t].period);
    setDuration(PRESETS[t].duration);
  }

  function priceForGrant(g: EquityGrant): number {
    if (g.type === "amazon_rsu") return prices.AMZN ?? 0;
    const fmvv = g.fmv_per_share ?? assumptions?.zoox_fmv_per_share ?? 0;
    return Math.max(0, fmvv - (g.strike_price ?? 0));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!units) return;
    const vest_schedule =
      useCustom && tranches.length > 0
        ? tranches
            .filter((t) => t.percent > 0)
            .map((t) => ({ month: t.month, fraction: t.percent / 100 }))
        : null;
    await insertRow("equity_grants", {
      label: label || (type === "amazon_rsu" ? "Amazon RSU" : "Zoox grant"),
      type,
      grant_date: grantDate,
      total_units: Number(units),
      strike_price: type === "zoox_option" ? Number(strike) || 0 : null,
      fmv_per_share: type === "zoox_option" && fmv ? Number(fmv) : null,
      cliff_months: cliff,
      period_months: period,
      duration_months: duration,
      vest_schedule,
    });
    setLabel("");
    setUnits("");
    setStrike("");
    setFmv("");
    setTranches([]);
    setUseCustom(false);
  }

  let totalVested = 0;
  let totalUnvested = 0;
  for (const g of grants) {
    const st = vestStatus(g);
    const per = priceForGrant(g);
    totalVested += st.vestedUnits * per;
    totalUnvested += st.unvestedUnits * per;
  }

  return (
    <div>
      <PageHeader
        title="Equity Grants"
        subtitle="Amazon RSUs (quarterly) and Zoox options (6-year). Zoox uses a manual share value."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Vested equity (gross)" value={currency(totalVested)} tone="good" />
        <StatCard label="Unvested equity (gross)" value={currency(totalUnvested)} />
        <StatCard
          label="Zoox FMV / share"
          value={currency(assumptions?.zoox_fmv_per_share ?? 0, 2)}
          sub="Set in Settings; per-grant override available"
        />
      </div>

      <form onSubmit={add} className="card mb-6">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={type === "amazon_rsu" ? "btn-primary" : "btn-ghost"}
            onClick={() => applyPreset("amazon_rsu")}
          >
            Amazon RSU
          </button>
          <button
            type="button"
            className={type === "zoox_option" ? "btn-primary" : "btn-ghost"}
            onClick={() => applyPreset("zoox_option")}
          >
            Zoox option
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Label">
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2025 refresh" />
          </Field>
          <Field label="Grant date">
            <input className="input" type="date" value={grantDate} onChange={(e) => setGrantDate(e.target.value)} />
          </Field>
          <Field label={type === "amazon_rsu" ? "Total RSUs" : "Total options"}>
            <input className="input" type="number" step="any" value={units} onChange={(e) => setUnits(e.target.value)} />
          </Field>
          {type === "zoox_option" && (
            <>
              <Field label="Strike price ($)">
                <input className="input" type="number" step="any" value={strike} onChange={(e) => setStrike(e.target.value)} />
              </Field>
              <Field label="FMV override ($)" hint="Blank = use Settings value">
                <input className="input" type="number" step="any" value={fmv} onChange={(e) => setFmv(e.target.value)} />
              </Field>
            </>
          )}
          {!useCustom && (
            <>
              <Field label="Cliff (months)">
                <input className="input" type="number" value={cliff} onChange={(e) => setCliff(Number(e.target.value))} />
              </Field>
              <Field label="Vest every (months)">
                <input className="input" type="number" value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
              </Field>
              <Field label="Total duration (months)">
                <input className="input" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </Field>
            </>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            Custom graded vesting schedule (e.g. Zoox ZARs)
          </label>
          {useCustom && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => setTranches(ZOOX_ZAR_PRESET.map((t) => ({ ...t })))}
                >
                  Zoox ZAR preset (0/15/20/20/20/25)
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => setTranches([...tranches, { month: 12, percent: 0 }])}
                >
                  + Add tranche
                </button>
                {tranches.length > 0 && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => setTranches([])}>
                    Clear
                  </button>
                )}
              </div>
              {tranches.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Add tranches or use the Zoox ZAR preset. Each row vests a % of the grant
                  at a month offset from the grant date.
                </p>
              ) : (
                <div className="space-y-2">
                  {tranches.map((t, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <input
                        className="input w-24"
                        type="number"
                        value={t.month}
                        onChange={(e) => updateTranche(idx, "month", Number(e.target.value))}
                      />
                      <span className="text-xs text-slate-500">months →</span>
                      <input
                        className="input w-24"
                        type="number"
                        step="any"
                        value={t.percent}
                        onChange={(e) => updateTranche(idx, "percent", Number(e.target.value))}
                      />
                      <span className="text-xs text-slate-500">%</span>
                      <span className="text-xs text-slate-400">
                        {formatDate(addMonths(new Date(grantDate), t.month).toISOString())}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => setTranches(tranches.filter((_, i) => i !== idx))}
                      >
                        remove
                      </button>
                    </div>
                  ))}
                  <div
                    className={`text-xs ${Math.abs(trancheTotal - 100) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    Total: {trancheTotal.toFixed(0)}%{" "}
                    {Math.abs(trancheTotal - 100) < 0.01 ? "✓" : "(should equal 100%)"}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <button className="btn-primary">Add grant</button>
        </div>
      </form>

      {grants.length === 0 ? (
        <EmptyState title="No grants yet" description="Add your Amazon RSU and Zoox option grants above." />
      ) : (
        <div className="space-y-4">
          {grants.map((g) => {
            const st = vestStatus(g);
            const per = priceForGrant(g);
            const pct = g.total_units > 0 ? st.vestedUnits / g.total_units : 0;
            return (
              <div key={g.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{g.label}</span>
                      <span
                        className={`pill ${g.type === "amazon_rsu" ? "bg-orange-50 text-orange-700" : "bg-violet-50 text-violet-700"}`}
                      >
                        {g.type === "amazon_rsu" ? "Amazon RSU" : "Zoox option"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Granted {formatDate(g.grant_date)} · {fmtShares(g.total_units)} units ·{" "}
                      {g.vest_schedule && g.vest_schedule.length > 0
                        ? `custom schedule (${g.vest_schedule.length} tranches)`
                        : `${g.cliff_months}mo cliff, every ${g.period_months}mo over ${g.duration_months}mo`}
                      {g.type === "zoox_option" && ` · base ${currency(g.strike_price ?? 0, 2)}`}
                    </div>
                  </div>
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => deleteRow("equity_grants", g.id)}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-slate-500">Vested</div>
                    <div className="font-medium">{fmtShares(st.vestedUnits)} · {currency(st.vestedUnits * per)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Unvested</div>
                    <div className="font-medium">{fmtShares(st.unvestedUnits)} · {currency(st.unvestedUnits * per)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Per-unit value</div>
                    <div className="font-medium">{currency(per, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Next vest</div>
                    <div className="font-medium">
                      {st.nextVest
                        ? `${formatDate(st.nextVest.date.toISOString())} (${fmtShares(st.nextVest.units)})`
                        : "Fully vested"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
