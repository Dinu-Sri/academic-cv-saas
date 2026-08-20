"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Percent, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";

type DiscountRow = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  value: number;
  planKey: "" | "pdf_pass" | "scholar_annual";
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  note: string;
  createdByAdminEmail: string;
  createdAt: string;
};

export function AdminDiscountCodesWorkspace() {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(20);
  const [planKey, setPlanKey] = useState<"" | "pdf_pass" | "scholar_annual">("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/discount-codes", { credentials: "include" });
    if (!response.ok) return;
    const payload = (await response.json()) as { discounts?: DiscountRow[] };
    setRows(payload.discounts || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function createCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/discount-codes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          discountType,
          value: Number(value),
          planKey,
          maxUses: maxUses.trim() ? Number(maxUses) : null,
          expiresAt: expiresAt.trim() ? new Date(expiresAt).toISOString() : null,
          note
        })
      });
      const body = (await response.json()) as { error?: string; discount?: DiscountRow };
      if (!response.ok) {
        setError(body.error || "Could not create discount code.");
        return;
      }
      setMessage(`Created ${body.discount?.code || code}.`);
      setCode("");
      setNote("");
      setMaxUses("");
      setExpiresAt("");
      await load();
    } catch {
      setError("Could not create discount code.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: DiscountRow) {
    setError("");
    const response = await fetch(`/api/admin/discount-codes/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Could not update code.");
      return;
    }
    await load();
  }

  return (
    <section className="workspace-screen admin-discount-workspace">
      <div className="screen-header">
        <div>
          <span className="section-label">Admin</span>
          <h1>Discount codes</h1>
          <p>Create percent or fixed USD codes for checkout. Codes appear on invoices when used.</p>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="billing-banner is-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="billing-banner is-success" role="status">
          <span>{message}</span>
        </div>
      ) : null}

      <div className="admin-discount-create card-panel">
        <h2>
          <Percent size={18} /> New discount code
        </h2>
        <div className="admin-discount-grid">
          <label>
            <span>Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME20"
              disabled={busy}
            />
          </label>
          <label>
            <span>Type</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
              disabled={busy}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed USD off</option>
            </select>
          </label>
          <label>
            <span>{discountType === "percent" ? "Percent" : "Amount (USD)"}</span>
            <input
              type="number"
              min={0.01}
              step={discountType === "percent" ? 1 : 0.01}
              max={discountType === "percent" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <label>
            <span>Plan</span>
            <select
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value as "" | "pdf_pass" | "scholar_annual")}
              disabled={busy}
            >
              <option value="">All paid plans</option>
              <option value="pdf_pass">PDF Pass only</option>
              <option value="scholar_annual">Scholar Annual only</option>
            </select>
          </label>
          <label>
            <span>Max uses (optional)</span>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              disabled={busy}
            />
          </label>
          <label>
            <span>Expires (optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="admin-discount-note">
            <span>Internal note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Campaign / partner"
              disabled={busy}
            />
          </label>
        </div>
        <button className="primary-action" type="button" disabled={busy || code.trim().length < 3} onClick={() => void createCode()}>
          {busy ? <Loader2 size={16} className="spin" /> : null}
          Create code
        </button>
      </div>

      <div className="admin-discount-list card-panel">
        <h2>Existing codes</h2>
        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No discount codes yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Plan</th>
                  <th>Uses</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.code}</strong>
                      {row.note ? <div className="muted">{row.note}</div> : null}
                    </td>
                    <td>
                      {row.discountType === "percent"
                        ? `${row.value}% off`
                        : `$${row.value.toFixed(2)} off`}
                    </td>
                    <td>{row.planKey || "All"}</td>
                    <td>
                      {row.usedCount}
                      {row.maxUses != null ? ` / ${row.maxUses}` : ""}
                    </td>
                    <td>
                      {row.expiresAt
                        ? new Date(row.expiresAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })
                        : "—"}
                    </td>
                    <td>
                      <span className={`admin-badge ${row.active ? "is-ok" : ""}`}>
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-action compact-action"
                        onClick={() => void toggleActive(row)}
                        title={row.active ? "Deactivate" : "Activate"}
                      >
                        {row.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {row.active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
