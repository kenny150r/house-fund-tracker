import { useState } from "react";
import { useData } from "../context/DataContext";
import { PageHeader, Field, EmptyState } from "../components/ui";
import { currency, formatDate, shares as fmtShares } from "../lib/format";
import type { AccountType, Holding, TxType } from "../lib/types";

export default function Holdings() {
  const { holdings, transactions, prices, insertRow, deleteRow } = useData();

  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [basis, setBasis] = useState("");
  const [acct, setAcct] = useState<AccountType>("brokerage");

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker) return;
    await insertRow("holdings", {
      ticker: ticker.toUpperCase().trim(),
      shares: Number(qty) || 0,
      cost_basis: Number(basis) || 0,
      account_type: acct,
    });
    setTicker("");
    setQty("");
    setBasis("");
  }

  function priceFor(h: Holding): number {
    if (h.account_type === "cash" || h.ticker.toUpperCase() === "CASH") return 1;
    return prices[h.ticker.toUpperCase()] ?? 0;
  }

  const total = holdings.reduce((s, h) => s + h.shares * priceFor(h), 0);

  return (
    <div>
      <PageHeader
        title="Holdings"
        subtitle="Cash and brokerage positions, valued with live prices."
      />

      <form onSubmit={addHolding} className="card mb-6 grid gap-3 sm:grid-cols-5">
        <Field label="Ticker">
          <input
            className="input"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="QQQ / AMZN / CASH"
          />
        </Field>
        <Field label={acct === "cash" ? "Amount ($)" : "Shares"}>
          <input
            className="input"
            type="number"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <Field label="Cost basis ($)">
          <input
            className="input"
            type="number"
            step="any"
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
          />
        </Field>
        <Field label="Account">
          <select
            className="input"
            value={acct}
            onChange={(e) => setAcct(e.target.value as AccountType)}
          >
            <option value="brokerage">Brokerage</option>
            <option value="cash">Cash</option>
            <option value="retirement">Retirement</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full">Add</button>
        </div>
      </form>

      {holdings.length === 0 ? (
        <EmptyState title="No holdings yet" description="Add your cash and brokerage positions above." />
      ) : (
        <div className="card mb-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Ticker</th>
                <th className="th">Account</th>
                <th className="th">Shares</th>
                <th className="th">Price</th>
                <th className="th">Value</th>
                <th className="th">Cost basis</th>
                <th className="th">Gain</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const price = priceFor(h);
                const value = h.shares * price;
                const gain = value - h.cost_basis;
                const isCash = h.account_type === "cash" || h.ticker.toUpperCase() === "CASH";
                return (
                  <tr key={h.id} className="border-b border-slate-50">
                    <td className="td font-semibold">{h.ticker.toUpperCase()}</td>
                    <td className="td capitalize">{h.account_type}</td>
                    <td className="td">{isCash ? "—" : fmtShares(h.shares)}</td>
                    <td className="td">{isCash ? "—" : currency(price, 2)}</td>
                    <td className="td font-medium">{currency(value)}</td>
                    <td className="td">{currency(h.cost_basis)}</td>
                    <td className={`td ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {isCash ? "—" : currency(gain)}
                    </td>
                    <td className="td text-right">
                      <button
                        className="text-xs text-red-500 hover:underline"
                        onClick={() => deleteRow("holdings", h.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="td font-bold" colSpan={4}>
                  Total
                </td>
                <td className="td font-bold">{currency(total)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <TransactionLogger />

      {transactions.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">Date</th>
                <th className="th">Type</th>
                <th className="th">Ticker</th>
                <th className="th">Shares</th>
                <th className="th">Price</th>
                <th className="th">Total</th>
                <th className="th">Note</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="td">{formatDate(t.date)}</td>
                  <td className="td">
                    <span
                      className={`pill ${t.type === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="td font-semibold">{t.ticker}</td>
                  <td className="td">{fmtShares(t.shares)}</td>
                  <td className="td">{currency(t.price, 2)}</td>
                  <td className="td">{currency(t.shares * t.price + t.fees)}</td>
                  <td className="td text-slate-400">{t.note}</td>
                  <td className="td text-right">
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => deleteRow("stock_transactions", t.id)}
                    >
                      Delete
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

function TransactionLogger() {
  const { holdings, insertRow, updateRow } = useData();
  const [type, setType] = useState<TxType>("buy");
  const [ticker, setTicker] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sym = ticker.toUpperCase().trim();
    const q = Number(qty);
    const p = Number(price);
    const f = Number(fees) || 0;
    if (!sym || !q || !p) return;
    setBusy(true);
    try {
      await insertRow("stock_transactions", {
        ticker: sym,
        type,
        shares: q,
        price: p,
        fees: f,
        date,
        note: note || null,
      });
      // Keep the matching holding in sync with the trade.
      const existing = holdings.find(
        (h) => h.ticker.toUpperCase() === sym && h.account_type !== "cash",
      );
      if (type === "buy") {
        if (existing) {
          await updateRow("holdings", existing.id, {
            shares: existing.shares + q,
            cost_basis: existing.cost_basis + q * p + f,
          });
        } else {
          await insertRow("holdings", {
            ticker: sym,
            shares: q,
            cost_basis: q * p + f,
            account_type: "brokerage",
          });
        }
      } else if (existing) {
        const avg = existing.shares > 0 ? existing.cost_basis / existing.shares : 0;
        const remaining = Math.max(0, existing.shares - q);
        await updateRow("holdings", existing.id, {
          shares: remaining,
          cost_basis: avg * remaining,
        });
      }
      setQty("");
      setPrice("");
      setFees("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mb-6">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Log a trade</h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Field label="Type">
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as TxType)}
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </Field>
        <Field label="Ticker">
          <input className="input" value={ticker} onChange={(e) => setTicker(e.target.value)} />
        </Field>
        <Field label="Shares">
          <input className="input" type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Price">
          <input className="input" type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Fees">
          <input className="input" type="number" step="any" value={fees} onChange={(e) => setFees(e.target.value)} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "…" : "Log"}
          </button>
        </div>
      </div>
      <input
        className="input mt-3"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </form>
  );
}
