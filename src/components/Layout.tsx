import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { formatDateTime } from "../lib/format";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/holdings", label: "Holdings" },
  { to: "/grants", label: "Equity Grants" },
  { to: "/income", label: "Income" },
  { to: "/expenses", label: "Expenses" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const { household, market, refreshMarket } = useData();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg">
            🏡
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-slate-900">
              House Fund
            </div>
            <div className="text-xs text-slate-500">{household?.name ?? ""}</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 py-4 text-xs text-slate-500 lg:block">
          <div className="mb-2">
            <button
              onClick={refreshMarket}
              className="font-medium text-brand-600 hover:underline"
            >
              Refresh market data
            </button>
          </div>
          {market && (
            <div className="space-y-0.5">
              <div>QQQ ${market.quotes.QQQ?.toFixed(2)}</div>
              <div>AMZN ${market.quotes.AMZN?.toFixed(2)}</div>
              <div>30yr {market.mortgageRate?.toFixed(2)}%</div>
              <div className="text-slate-400">
                {market.stale
                  ? "estimated"
                  : `updated ${formatDateTime(market.asOf)}`}
              </div>
            </div>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="truncate text-slate-600">{user?.email}</div>
            <button onClick={signOut} className="mt-1 text-red-500 hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
