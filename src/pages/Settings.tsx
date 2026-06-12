import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Field } from "../components/ui";
import { currency } from "../lib/format";
import type { Assumptions } from "../lib/types";

export default function Settings() {
  const { assumptions, saveAssumptions, household, market } = useData();
  const { signOut, user } = useAuth();
  const [form, setForm] = useState<Assumptions | null>(assumptions);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setForm(assumptions), [assumptions]);

  if (!form) return <div className="text-slate-500">Loading…</div>;

  const num = (k: keyof Assumptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value === "" ? 0 : Number(e.target.value) });

  const forecast = form.zoox_fmv_forecast ?? [];
  const setForecast = (next: typeof forecast) =>
    setForm({ ...form, zoox_fmv_forecast: next.length ? next : null });
  const updateForecast = (idx: number, key: "year" | "low" | "high", val: number) =>
    setForecast(forecast.map((p, i) => (i === idx ? { ...p, [key]: val } : p)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    await saveAssumptions(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyId() {
    if (household) {
      navigator.clipboard.writeText(household.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Assumptions that drive every projection." />

      <form onSubmit={save} className="space-y-6">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Home goal</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target house price ($)">
              <input className="input" type="number" value={form.target_house_price} onChange={num("target_house_price")} />
            </Field>
            <Field label="Down payment (%)" hint="As a decimal, e.g. 0.20 = 20%">
              <input className="input" type="number" step="0.01" value={form.down_payment_pct} onChange={num("down_payment_pct")} />
            </Field>
            <Field label="Closing costs (%)">
              <input className="input" type="number" step="0.01" value={form.closing_cost_pct} onChange={num("closing_cost_pct")} />
            </Field>
            <Field label="Max DTI (%)" hint="0.36 = 36% of gross income">
              <input className="input" type="number" step="0.01" value={form.dti_max_pct} onChange={num("dti_max_pct")} />
            </Field>
            <Field label="Property tax rate (% / yr)">
              <input className="input" type="number" step="0.01" value={form.property_tax_rate} onChange={num("property_tax_rate")} />
            </Field>
            <Field label="Home insurance ($ / yr)">
              <input className="input" type="number" value={form.home_insurance_annual} onChange={num("home_insurance_annual")} />
            </Field>
            <Field label="HOA ($ / mo)">
              <input className="input" type="number" value={form.hoa_monthly} onChange={num("hoa_monthly")} />
            </Field>
            <Field
              label="Mortgage rate override (%)"
              hint={`Blank = live ${market?.mortgageRate?.toFixed(2) ?? "?"}%`}
            >
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.mortgage_rate_override ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mortgage_rate_override: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Current home (starter house)</h2>
          <p className="mb-4 text-xs text-slate-400">
            Its equity counts toward net worth. If you'll sell it to buy the next
            place, net sale proceeds also count toward your down-payment fund.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current home value ($)">
              <input className="input" type="number" value={form.current_home_value} onChange={num("current_home_value")} />
            </Field>
            <Field label="Mortgage balance ($)">
              <input className="input" type="number" value={form.current_mortgage_balance} onChange={num("current_mortgage_balance")} />
            </Field>
            <Field label="Home appreciation (% / yr)">
              <input className="input" type="number" step="0.1" value={form.home_appreciation_pct} onChange={num("home_appreciation_pct")} />
            </Field>
            <Field label="Selling costs (%)" hint="Agent + closing, e.g. 0.06 = 6%">
              <input className="input" type="number" step="0.01" value={form.home_sale_cost_pct} onChange={num("home_sale_cost_pct")} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={form.sell_home_for_down_payment}
              onChange={(e) => setForm({ ...form, sell_home_for_down_payment: e.target.checked })}
            />
            <span className="text-sm text-slate-600">
              Sell this home and use its equity toward the down payment
            </span>
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Current equity:{" "}
            {currency(Math.max(0, form.current_home_value - form.current_mortgage_balance))}
            {" · "}net if sold:{" "}
            {currency(
              Math.max(
                0,
                form.current_home_value * (1 - form.home_sale_cost_pct) -
                  form.current_mortgage_balance,
              ),
            )}
          </p>
        </section>

        <section className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">Growth & inflation (annual %)</h2>
          <p className="mb-4 text-xs text-slate-400">
            Set Low / Midpoint / High annual growth per driver. The band below picks which
            the projection uses; the Dashboard can shade the full Low–High range.
          </p>

          <div className="mb-4">
            <span className="label">Forecast band (applies to all equities)</span>
            <div className="flex gap-2">
              {(["low", "mid", "high"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  className={form.forecast_band === b ? "btn-primary" : "btn-ghost"}
                  onClick={() => setForm({ ...form, forecast_band: b, zoox_forecast_band: b })}
                >
                  {b === "low" ? "Low" : b === "high" ? "High" : "Midpoint"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-20">Driver</span>
              <span className="w-24">Low %</span>
              <span className="w-24">Mid %</span>
              <span className="w-24">High %</span>
            </div>
            <GrowthRow
              label="QQQ"
              low={form.growth_qqq_low_pct}
              mid={form.growth_qqq_pct}
              high={form.growth_qqq_high_pct}
              onLow={num("growth_qqq_low_pct")}
              onMid={num("growth_qqq_pct")}
              onHigh={num("growth_qqq_high_pct")}
            />
            <GrowthRow
              label="AMZN"
              low={form.growth_amzn_low_pct}
              mid={form.growth_amzn_pct}
              high={form.growth_amzn_high_pct}
              onLow={num("growth_amzn_low_pct")}
              onMid={num("growth_amzn_pct")}
              onHigh={num("growth_amzn_high_pct")}
            />
            <GrowthRow
              label="Salary"
              low={form.salary_growth_low_pct}
              mid={form.salary_growth_pct}
              high={form.salary_growth_high_pct}
              onLow={num("salary_growth_low_pct")}
              onMid={num("salary_growth_pct")}
              onHigh={num("salary_growth_high_pct")}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Zoox growth (fallback %)" hint="Used only when no ZAR forecast">
              <input className="input" type="number" step="0.1" value={form.growth_zoox_pct} onChange={num("growth_zoox_pct")} />
            </Field>
            <Field label="Expense inflation">
              <input className="input" type="number" step="0.1" value={form.inflation_pct} onChange={num("inflation_pct")} />
            </Field>
            <Field label="Projection horizon (years)">
              <input className="input" type="number" value={form.projection_years} onChange={num("projection_years")} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Zoox FMV / share ($)" hint="Private valuation; drives option value">
              <input className="input" type="number" step="0.01" value={form.zoox_fmv_per_share} onChange={num("zoox_fmv_per_share")} />
            </Field>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={form.reinvest_savings}
                onChange={(e) => setForm({ ...form, reinvest_savings: e.target.checked })}
              />
              <span className="text-sm text-slate-600">Grow monthly savings at QQQ rate (vs hold as cash)</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            Zoox ZAR price forecast
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            Enter Zoox's low/high estimated ZAR price per share by year. When present,
            projections interpolate this band instead of the flat Zoox growth % above.
            Year 0 uses the current FMV ({currency(form.zoox_fmv_per_share, 2)}).
          </p>

          <p className="mb-4 text-xs text-slate-400">
            The Low/Midpoint/High band is shared with the other equities — set it in the
            Growth section above.
          </p>

          {forecast.length === 0 ? (
            <p className="text-xs text-slate-400">
              No forecast yet — using flat growth. Add yearly points below.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="w-28">Years from now</span>
                <span className="w-32">Low ($/share)</span>
                <span className="w-32">High ($/share)</span>
              </div>
              {forecast.map((p, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    className="input w-28"
                    type="number"
                    step="0.5"
                    value={p.year}
                    onChange={(e) => updateForecast(idx, "year", Number(e.target.value))}
                  />
                  <input
                    className="input w-32"
                    type="number"
                    step="any"
                    value={p.low}
                    onChange={(e) => updateForecast(idx, "low", Number(e.target.value))}
                  />
                  <input
                    className="input w-32"
                    type="number"
                    step="any"
                    value={p.high}
                    onChange={(e) => updateForecast(idx, "high", Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => setForecast(forecast.filter((_, i) => i !== idx))}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                setForecast([
                  ...forecast,
                  { year: forecast.length + 1, low: 0, high: 0 },
                ])
              }
            >
              + Add year
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Taxes</h2>
          <Field label="Filing status">
            <select
              className="input max-w-xs"
              value={form.filing_status}
              onChange={(e) => setForm({ ...form, filing_status: e.target.value as Assumptions["filing_status"] })}
            >
              <option value="mfj">Married filing jointly</option>
              <option value="single">Single</option>
            </select>
          </Field>
          <p className="mt-3 text-xs text-slate-400">
            California + federal estimate including FICA and NIIT. Not tax advice.
          </p>
        </section>

        <div className="flex items-center gap-3">
          <button className="btn-primary">Save assumptions</button>
          {saved && <span className="text-sm text-emerald-600">Saved!</span>}
        </div>
      </form>

      <section className="card mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Household</h2>
        <p className="text-sm text-slate-500">
          Share this ID with your partner so they can join from the onboarding screen.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs">
            {household?.id}
          </code>
          <button type="button" className="btn-ghost" onClick={copyId}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Signed in as {user?.email}
          <button type="button" onClick={signOut} className="ml-3 text-red-500 hover:underline">
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => void;

function GrowthRow({
  label,
  low,
  mid,
  high,
  onLow,
  onMid,
  onHigh,
}: {
  label: string;
  low: number;
  mid: number;
  high: number;
  onLow: ChangeHandler;
  onMid: ChangeHandler;
  onHigh: ChangeHandler;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-sm font-medium text-slate-600">{label}</span>
      <input className="input w-24" type="number" step="0.1" value={low} onChange={onLow} />
      <input className="input w-24" type="number" step="0.1" value={mid} onChange={onMid} />
      <input className="input w-24" type="number" step="0.1" value={high} onChange={onHigh} />
    </div>
  );
}
