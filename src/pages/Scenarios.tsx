import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";
import { runProjection } from "../lib/projection";
import { PageHeader, StatCard, Slider } from "../components/ui";
import { compactCurrency, currency, formatDate, percent, yearTicks } from "../lib/format";
import { ZERO_SCENARIO, type DataSnapshot, type ScenarioOverrides } from "../lib/types";

export default function Scenarios() {
  const { snapshot, income } = useData();
  const [s, setS] = useState<ScenarioOverrides>({ ...ZERO_SCENARIO });

  const set = <K extends keyof ScenarioOverrides>(k: K, v: ScenarioOverrides[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const baseline = useMemo(
    () => (snapshot ? runProjection(snapshot, ZERO_SCENARIO) : null),
    [snapshot],
  );
  const scenario = useMemo(
    () => (snapshot ? runProjection(snapshot, s) : null),
    [snapshot, s],
  );

  const shiftRate = useMemo(() => {
    const shift = income.find((i) => i.type === "shift");
    return shift?.shift_rate ?? 0;
  }, [income]);

  const chartData = useMemo(() => {
    if (!baseline || !scenario) return [];
    return baseline.points.map((p, idx) => ({
      date: new Date(p.date).getTime(),
      baseline: Math.round(p.liquid),
      scenario: Math.round(scenario.points[idx]?.liquid ?? 0),
      required: Math.round(p.requiredCash),
    }));
  }, [baseline, scenario]);

  if (!snapshot || !baseline || !scenario) {
    return <div className="text-slate-500">Loading…</div>;
  }

  const baseDate = baseline.affordableMonthIndex;
  const scenDate = scenario.affordableMonthIndex;
  const monthsSaved =
    baseDate != null && scenDate != null ? baseDate - scenDate : null;

  const targetPrice = s.targetHousePrice ?? snapshot.assumptions.target_house_price;
  const downPct = s.downPaymentPct ?? snapshot.assumptions.down_payment_pct;

  return (
    <div>
      <PageHeader
        title="Scenarios"
        subtitle="Drag the sliders to see how shifts, spending, growth, and the target home change your timeline."
        actions={
          <button className="btn-ghost" onClick={() => setS({ ...ZERO_SCENARIO })}>
            Reset
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Baseline affordable"
          value={baseline.affordableDate ? formatDate(baseline.affordableDate) : "Out of range"}
        />
        <StatCard
          label="Scenario affordable"
          value={scenario.affordableDate ? formatDate(scenario.affordableDate) : "Out of range"}
          tone={scenario.affordableDate ? "good" : "bad"}
        />
        <StatCard
          label="Timeline impact"
          value={
            monthsSaved == null
              ? "—"
              : monthsSaved === 0
                ? "No change"
                : `${monthsSaved > 0 ? "−" : "+"}${Math.abs(monthsSaved)} months`
          }
          sub={monthsSaved && monthsSaved > 0 ? "Sooner" : monthsSaved ? "Later" : undefined}
          tone={monthsSaved && monthsSaved > 0 ? "good" : monthsSaved ? "bad" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-slate-700">What-if levers</h2>
          <div>
            <span className="label mb-1">Forecast band (all equities)</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["low", "Low"],
                ["mid", "Midpoint"],
                ["high", "High"],
                [null, "Default"],
              ] as const).map(([val, lbl]) => (
                <button
                  key={lbl}
                  type="button"
                  className={
                    (s.band ?? null) === val
                      ? "btn-primary text-xs"
                      : "btn-ghost text-xs"
                  }
                  onClick={() => set("band", val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Extra nursing shifts / month"
            value={s.extraShiftsPerMonth}
            min={0}
            max={12}
            step={1}
            onChange={(v) => set("extraShiftsPerMonth", v)}
            format={(v) =>
              `${v} (${compactCurrency(v * shiftRate)}/mo gross)`
            }
          />
          <Slider
            label="Spending change"
            value={s.expenseDeltaPct}
            min={-0.5}
            max={0.5}
            step={0.05}
            onChange={(v) => set("expenseDeltaPct", v)}
            format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`}
          />
          <Slider
            label="Rent override (monthly)"
            value={s.rentOverride ?? findRent(snapshot)}
            min={0}
            max={8000}
            step={50}
            onChange={(v) => set("rentOverride", v)}
            format={(v) => currency(v)}
          />
          <Slider
            label="Extra monthly savings"
            value={s.extraMonthlyContribution}
            min={0}
            max={10000}
            step={100}
            onChange={(v) => set("extraMonthlyContribution", v)}
            format={(v) => currency(v)}
          />
          <Slider
            label="Market growth adjustment"
            value={s.growthAdjustPct}
            min={-6}
            max={6}
            step={0.5}
            onChange={(v) => set("growthAdjustPct", v)}
            format={(v) => `${v > 0 ? "+" : ""}${v}% / yr`}
          />
          <Slider
            label="Target house price"
            value={targetPrice}
            min={300000}
            max={2500000}
            step={25000}
            onChange={(v) => set("targetHousePrice", v)}
            format={(v) => compactCurrency(v)}
          />
          <Slider
            label="Down payment"
            value={downPct}
            min={0.03}
            max={0.5}
            step={0.01}
            onChange={(v) => set("downPaymentPct", v)}
            format={(v) => percent(v, 0)}
          />
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              Liquid funds: baseline vs scenario
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis
                  dataKey="date"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  ticks={yearTicks(chartData.map((d) => d.date))}
                  interval={0}
                  tickFormatter={(t) => String(new Date(t).getFullYear())}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => compactCurrency(v)} tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(v: number) => currency(v)}
                  labelFormatter={(t) => formatDate(new Date(t).toISOString())}
                />
                <Legend />
                <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#94a3b8" dot={false} />
                <Line type="monotone" dataKey="scenario" name="Scenario" stroke="#1f59e0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="required" name="Required" stroke="#dc2626" strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Scenario monthly payment"
              value={currency(scenario.monthlyPiti)}
              sub={`DTI ${percent(scenario.dtiRatio)}`}
              tone={scenario.dtiPasses ? "good" : "bad"}
            />
            <StatCard
              label="Required cash"
              value={currency(scenario.requiredCash)}
              sub={`${percent(downPct, 0)} down + closing`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function findRent(snapshot: DataSnapshot): number {
  const rent = snapshot.expenses.find((e) => /rent/i.test(e.name));
  return rent ? rent.amount : 3000;
}
