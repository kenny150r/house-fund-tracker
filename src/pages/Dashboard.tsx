import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../context/DataContext";
import { useProjection } from "../hooks/useProjection";
import { PageHeader, StatCard, EmptyState } from "../components/ui";
import { compactCurrency, currency, formatDate, percent, yearTicks } from "../lib/format";

export default function Dashboard() {
  const { snapshot, assumptions, market, seedStarterData, holdings } = useData();
  const projection = useProjection();

  const hasData = holdings.length > 0 || (snapshot?.income.length ?? 0) > 0;

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.points
      .map((p) => ({
        date: new Date(p.date).getTime(),
        vested: Math.round(p.vestedNetWorth),
        unvested: Math.round(p.unvestedNetWorth),
        liquid: Math.round(p.liquid),
        required: Math.round(p.requiredCash),
      }));
  }, [projection]);

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
            ? `QQQ $${market.quotes.QQQ?.toFixed(0)} · AMZN $${market.quotes.AMZN?.toFixed(0)} · 30yr ${market.mortgageRate?.toFixed(2)}%${market.stale ? " (estimated)" : ""}`
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
          sub="Cash + brokerage + vested equity"
          tone="good"
        />
        <StatCard
          label="Incl. unvested"
          value={currency(projection.startingUnvestedNetWorth)}
          sub="After-tax, all grants fully vested"
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
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Net worth projection
          </h2>
          <ResponsiveContainer width="100%" height={280}>
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
              <YAxis
                tickFormatter={(v) => compactCurrency(v)}
                tick={{ fontSize: 11 }}
                width={56}
              />
              <Tooltip
                formatter={(v: number) => currency(v)}
                labelFormatter={(t) => formatDate(new Date(t).toISOString())}
              />
              <Area
                type="monotone"
                dataKey="unvested"
                name="Incl. unvested"
                stroke="#94a3b8"
                fill="url(#gUnvested)"
              />
              <Area
                type="monotone"
                dataKey="vested"
                name="Vested"
                stroke="#1f59e0"
                fill="url(#gVested)"
              />
            </AreaChart>
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
