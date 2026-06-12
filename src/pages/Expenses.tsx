import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { PageHeader, Field, EmptyState, StatCard } from "../components/ui";
import { currency, toMonthly } from "../lib/format";
import type { ExpenseCadence } from "../lib/types";

const CATEGORIES = [
  "Housing",
  "Utilities",
  "Auto",
  "Debt",
  "Food",
  "Pets",
  "Fitness",
  "Subscriptions",
  "Insurance",
  "Other",
];

export default function Expenses() {
  const { expenses, insertRow, updateRow, deleteRow } = useData();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Housing");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState<ExpenseCadence>("monthly");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    await insertRow("expenses", {
      name,
      category,
      amount: Number(amount),
      cadence,
      active: true,
    });
    setName("");
    setAmount("");
  }

  const monthlyTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.active)
        .reduce((s, e) => s + toMonthly(e.amount, e.cadence), 0),
    [expenses],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (!e.active) continue;
      map.set(e.category, (map.get(e.category) ?? 0) + toMonthly(e.amount, e.cadence));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Recurring outflows. Toggle items off to see the impact, or model cuts in Scenarios."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total / month" value={currency(monthlyTotal)} tone="warn" />
        <StatCard label="Total / year" value={currency(monthlyTotal * 12)} />
        <StatCard label="Active items" value={expenses.filter((e) => e.active).length} />
      </div>

      <form onSubmit={add} className="card mb-6 grid gap-3 sm:grid-cols-5">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent" />
        </Field>
        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount ($)">
          <input className="input" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Cadence">
          <select className="input" value={cadence} onChange={(e) => setCadence(e.target.value as ExpenseCadence)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full">Add</button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" description="Add rent, utilities, subscriptions, and more above." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">Name</th>
                    <th className="th">Category</th>
                    <th className="th">Amount</th>
                    <th className="th">Cadence</th>
                    <th className="th">Monthly</th>
                    <th className="th">Active</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50">
                      <td className="td font-medium">{e.name}</td>
                      <td className="td text-slate-500">{e.category}</td>
                      <td className="td">{currency(e.amount, 2)}</td>
                      <td className="td capitalize">{e.cadence}</td>
                      <td className="td font-medium">{currency(toMonthly(e.amount, e.cadence))}</td>
                      <td className="td">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-600"
                          checked={e.active}
                          onChange={() => updateRow("expenses", e.id, { active: !e.active })}
                        />
                      </td>
                      <td className="td text-right">
                        <button className="text-xs text-red-500 hover:underline" onClick={() => deleteRow("expenses", e.id)}>
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

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">By category / month</h2>
          {byCategory.length === 0 ? (
            <div className="text-sm text-slate-400">No active expenses.</div>
          ) : (
            <div className="space-y-3">
              {byCategory.map(([cat, amt]) => {
                const pct = monthlyTotal > 0 ? amt / monthlyTotal : 0;
                return (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-medium">{currency(amt)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
