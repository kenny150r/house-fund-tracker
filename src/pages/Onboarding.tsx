import { useState } from "react";
import { useData } from "../context/DataContext";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Onboarding() {
  const { createHousehold } = useData();
  const { user } = useAuth();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Our Household");
  const [displayName, setDisplayName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createHousehold(name.trim() || "Our Household", displayName.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create household");
    } finally {
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from("household_members").insert({
        household_id: joinId.trim(),
        user_id: user.id,
        role: "member",
        display_name: displayName.trim(),
      });
      if (err) throw err;
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not join household — check the ID",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Welcome!</h1>
        <p className="mb-5 text-sm text-slate-500">
          Set up your household. You and your partner share the same household data.
        </p>
        <div className="mb-4 flex gap-2">
          <button
            className={mode === "create" ? "btn-primary flex-1" : "btn-ghost flex-1"}
            onClick={() => setMode("create")}
          >
            Create new
          </button>
          <button
            className={mode === "join" ? "btn-primary flex-1" : "btn-ghost flex-1"}
            onClick={() => setMode("join")}
          >
            Join partner's
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={create} className="card space-y-4">
            <div>
              <label className="label">Household name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Your display name</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Kenny"
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create household"}
            </button>
          </form>
        ) : (
          <form onSubmit={join} className="card space-y-4">
            <div>
              <label className="label">Household ID</label>
              <input
                className="input"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="Paste the ID your partner shared (Settings page)"
              />
            </div>
            <div>
              <label className="label">Your display name</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Joining…" : "Join household"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
