import { useEffect, useState } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Field } from "../components/ui";
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
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Growth & inflation (annual %)</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="QQQ growth">
              <input className="input" type="number" step="0.1" value={form.growth_qqq_pct} onChange={num("growth_qqq_pct")} />
            </Field>
            <Field label="AMZN growth">
              <input className="input" type="number" step="0.1" value={form.growth_amzn_pct} onChange={num("growth_amzn_pct")} />
            </Field>
            <Field label="Zoox growth">
              <input className="input" type="number" step="0.1" value={form.growth_zoox_pct} onChange={num("growth_zoox_pct")} />
            </Field>
            <Field label="Salary growth">
              <input className="input" type="number" step="0.1" value={form.salary_growth_pct} onChange={num("salary_growth_pct")} />
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
