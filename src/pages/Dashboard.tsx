import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";
import { useProjection } from "../hooks/useProjection";
import { runProjection } from "../lib/projection";
import { ZERO_SCENARIO } from "../lib/types";
import { PageHeader, StatCard, EmptyState } from "../components/ui";
import { compactCurrency, currency, formatDate, formatDateTime, percent, yearTicks } from "../lib/format";

export default function Dashboard() {
  const { snapshot, assumptions, market, seedStarterData, holdings } = useData();
  const projection = useProjection();
  const [showBand, setShowBand] = useState(false);

  const hasData = holdings.length > 0 || (snapshot?.income.length ?? 0) > 0;

  // Low/high projections drive the shaded range on the net-worth chart.
  const lowProj = useMemo(
    () => (snapshot ? runProjection(snapshot, { ...ZERO_SCENARIO, band: "low" }) : null),
    [snapshot],
  );
  const highProj = useMemo(
    () => (snapshot ? runProjection(snapshot, { ...ZERO_SCENARIO, band: "high" }) : null),
    [snapshot],
  );

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.points.map((p, i) => {
      const lo = Math.round(lowProj?.points[i]?.totalNetWorth ?? p.totalNetWorth);
      const hi = Math.round(highProj?.points[i]?.totalNetWorth ?? p.totalNetWorth);
      return {
        date: new Date(p.date).getTime(),
        vested: Math.round(p.vestedNetWorth),
        unvested: Math.round(p.unvestedNetWorth),
        selected: Math.round(p.totalNetWorth),
        bandLow: lo,
        bandSpan: Math.max(0, hi - lo),
        bandHigh: hi,
        liquid: Math.round(p.liquid),
        required: Math.round(p.requiredCash),
      };
    });
  }, [projection, lowProj, highProj]);

  if (!assumptions || !projection) {
    return <div className="text-slate-500">Loading…</div>;
  }

  const affordable = projection.affordableDate;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          market
            ? `QQQ $${market.quotes.QQQ?.toFixed(0)} · AMZN $${market.quotes.AMZN?.toFixed(0)} · 30yr ${market.mortgageRate?.toFixed(2)}% · ${market.stale ? "estimated" : `updated ${formatDateTime(market.asOf)}`}`
            : undefined
        }
      />

      {!hasData && (
        <div className="mb-6">
          <EmptyState
            title="Start by adding your finances"
            description="Add holdings, grants, income, and expenses — or load realistic starter data you can edit."
            action={
              <button className="btn-primary" onClick={() => seedStarterData()}>
                Load starter data
              </button>
            }
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vested net worth"
          value={currency(projection.startingVestedNetWorth)}
          sub="Cash + brokerage + vested equity + home"
          tone="good"
        />
        <StatCard
          label="Incl. unvested"
          value={currency(projection.startingUnvestedNetWorth)}
          sub="Vested + unvested grants, after-tax at today's prices"
        />
        <StatCard
          label="Liquid for down payment"
          value={currency(projection.startingLiquid)}
          sub={`Need ${compactCurrency(projection.requiredCash)}`}
          tone={projection.startingLiquid >= projection.requiredCash ? "good" : "warn"}
        />
        <StatCard
          label="Affordable by"
          value={affordable ? formatDate(affordable) : "Not in range"}
          sub={
            affordable
              ? `${projection.affordableMonthIndex} months out`
              : `Extend horizon or adjust scenario`
          }
          tone={affordable ? "good" : "bad"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Net worth projection</h2>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={showBand}
                onChange={(e) => setShowBand(e.target.checked)}
              />
              Low–High range
            </label>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {showBand ? (
              <ComposedChart data={chartData} margin={{ left: 8, right: 8 }}>
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
                  formatter={(v: number, name: string) =>
                    name === "_base" ? null : currency(v)
                  }
                  labelFormatter={(t) => formatDate(new Date(t).toISOString())}
                />
                {/* Invisible base + shaded span = a low-to-high band. */}
                <Area dataKey="bandLow" name="_base" stackId="band" stroke="none" fill="none" legendType="none" />
                <Area
                  dataKey="bandSpan"
                  name="Low–High range"
                  stackId="band"
                  stroke="none"
                  fill="#1f59e0"
                  fillOpacity={0.15}
                />
                <Line type="monotone" dataKey="bandHigh" name="High" stroke="#86b3ff" dot={false} strokeWidth={1} />
                <Line type="monotone" dataKey="bandLow" name="Low" stroke="#86b3ff" dot={false} strokeWidth={1} />
                <Line type="monotone" dataKey="selected" name="Selected band" stroke="#1f59e0" dot={false} strokeWidth={2} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="gVested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1f59e0" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#1f59e0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gUnvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area type="monotone" dataKey="unvested" name="Incl. unvested" stroke="#94a3b8" fill="url(#gUnvested)" />
                <Area type="monotone" dataKey="vested" name="Vested" stroke="#1f59e0" fill="url(#gVested)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Down payment fund vs. target
          </h2>
          <ResponsiveContainer width="100%" height={280}>
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
              <YAxis
                tickFormatter={(v) => compactCurrency(v)}
                tick={{ fontSize: 11 }}
                width={56}
              />
              <Tooltip
                formatter={(v: number) => currency(v)}
                labelFormatter={(t) => formatDate(new Date(t).toISOString())}
              />
              <Line
                type="monotone"
                dataKey="liquid"
                name="Liquid available"
                stroke="#059669"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="required"
                name="Required cash"
                stroke="#dc2626"
                strokeDasharray="6 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Target house"
          value={currency(assumptions.target_house_price)}
          sub={`${percent(assumptions.down_payment_pct, 0)} down`}
        />
        <StatCard
          label="Est. monthly payment"
          value={currency(projection.monthlyPiti)}
          sub="PITI incl. taxes & insurance"
        />
        <StatCard
          label="Debt-to-income"
          value={percent(projection.dtiRatio)}
          sub={`Max ${percent(assumptions.dti_max_pct, 0)} · income ${compactCurrency(projection.grossMonthlyIncome)}/mo incl. ${compactCurrency(projection.equityMonthlyIncome)} equity`}
          tone={projection.dtiPasses ? "good" : "bad"}
        />
        <StatCard
          label="Mortgage rate"
          value={`${(assumptions.mortgage_rate_override ?? snapshot?.mortgageRate ?? 0).toFixed(2)}%`}
          sub={assumptions.mortgage_rate_override ? "manual override" : "live 30yr"}
        />
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Projections are estimates for planning only and not financial or tax advice.
        Adjust assumptions in{" "}
        <Link to="/settings" className="text-brand-600 hover:underline">
          Settings
        </Link>{" "}
        or model changes in{" "}
        <Link to="/scenarios" className="text-brand-600 hover:underline">
          Scenarios
        </Link>
        .
      </p>
    </div>
  );
}
