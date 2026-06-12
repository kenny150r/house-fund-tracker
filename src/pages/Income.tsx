import { useState } from "react";
import { useData } from "../context/DataContext";
import { PageHeader, Field, EmptyState, StatCard } from "../components/ui";
import { currency } from "../lib/format";
import { estimateAnnualTax } from "../lib/tax";
import type { IncomeOwner, IncomeType } from "../lib/types";

export default function Income() {
  const { income, assumptions, insertRow, deleteRow } = useData();
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState<IncomeOwner>("you");
  const [type, setType] = useState<IncomeType>("salary");
  const [annual, setAnnual] = useState("");
  const [shiftRate, setShiftRate] = useState("");
  const [shiftsPerMonth, setShiftsPerMonth] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await insertRow("income_sources", {
      label: label || "Income",
      owner,
      type,
      annual_amount: type === "shift" ? 0 : Number(annual) || 0,
      shift_rate: type === "shift" ? Number(shiftRate) || 0 : 0,
      shifts_per_month: type === "shift" ? Number(shiftsPerMonth) || 0 : 0,
    });
    setLabel("");
    setAnnual("");
    setShiftRate("");
    setShiftsPerMonth("");
  }

  function annualOf(i: (typeof income)[number]): number {
    return i.type === "shift"
      ? i.shift_rate * i.shifts_per_month * 12
      : i.annual_amount;
  }

  const grossAnnual = income.reduce((s, i) => s + annualOf(i), 0);
  const youWages = income.filter((i) => i.owner === "you").reduce((s, i) => s + annualOf(i), 0);
  const spouseWages = income
    .filter((i) => i.owner !== "you")
    .reduce((s, i) => s + annualOf(i), 0);

  const tax = estimateAnnualTax({
    filing: assumptions?.filing_status ?? "mfj",
    wagesByOwner: [youWages, spouseWages],
    supplementalOrdinary: 0,
    longTermGains: 0,
  });

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Salary and variable nursing shifts. Extra shifts are modeled in Scenarios."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Gross / year" value={currency(grossAnnual)} />
        <StatCard label="Gross / month" value={currency(grossAnnual / 12)} />
        <StatCard
          label="Est. take-home / yr"
          value={currency(tax.netIncome)}
          sub={`Eff. rate ${(tax.effectiveRate * 100).toFixed(1)}%`}
          tone="good"
        />
        <StatCard
          label="Est. take-home / mo"
          value={currency(tax.netIncome / 12)}
          sub="CA + federal + FICA"
        />
      </div>

      <form onSubmit={add} className="card mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Label">
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Base salary" />
          </Field>
          <Field label="Owner">
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value as IncomeOwner)}>
              <option value="you">You</option>
              <option value="spouse">Spouse</option>
              <option value="joint">Joint</option>
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as IncomeType)}>
              <option value="salary">Salary (annual)</option>
              <option value="shift">Shift-based</option>
              <option value="hourly">Other annual</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {type === "shift" ? (
            <>
              <Field label="$ per shift">
                <input className="input" type="number" step="any" value={shiftRate} onChange={(e) => setShiftRate(e.target.value)} />
              </Field>
              <Field label="Shifts / month">
                <input className="input" type="number" step="any" value={shiftsPerMonth} onChange={(e) => setShiftsPerMonth(e.target.value)} />
              </Field>
            </>
          ) : (
            <Field label="Gross annual ($)">
              <input className="input" type="number" step="any" value={annual} onChange={(e) => setAnnual(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="mt-4">
          <button className="btn-primary">Add income source</button>
        </div>
      </form>

      {income.length === 0 ? (
        <EmptyState title="No income yet" description="Add salary and nursing shift income above." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Source</th>
                <th className="th">Owner</th>
                <th className="th">Type</th>
                <th className="th">Detail</th>
                <th className="th">Gross / year</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {income.map((i) => (
                <tr key={i.id} className="border-b border-slate-50">
                  <td className="td font-semibold">{i.label}</td>
                  <td className="td capitalize">{i.owner}</td>
                  <td className="td capitalize">{i.type}</td>
                  <td className="td text-slate-500">
                    {i.type === "shift"
                      ? `${currency(i.shift_rate)} × ${i.shifts_per_month}/mo`
                      : currency(i.annual_amount) + "/yr"}
                  </td>
                  <td className="td font-medium">{currency(annualOf(i))}</td>
                  <td className="td text-right">
                    <button className="text-xs text-red-500 hover:underline" onClick={() => deleteRow("income_sources", i.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
