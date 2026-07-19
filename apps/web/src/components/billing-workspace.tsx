"use client";

import { createPortal } from "react-dom";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Globe2,
  Loader2,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import type { BillingStatusPayload, PaidPlanKey, PlanKey } from "@/lib/billing/plans";

type Props = {
  initialData: BillingStatusPayload;
};

function subscribeToStaticDom(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function BillingWorkspace({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const statusSlot = useSyncExternalStore(
    subscribeToStaticDom,
    () => document.getElementById("billing-status-slot"),
    () => null
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/billing");
    if (!response.ok) return;
    const payload = (await response.json()) as BillingStatusPayload;
    setData(payload);
  }, []);

  const selectedPlan = useMemo(
    () => (checkoutPlan ? data.plans.find((p) => p.key === checkoutPlan) : null),
    [checkoutPlan, data.plans]
  );

  function closeCheckout() {
    setCheckoutPlan(null);
    setBusy(false);
    setError("");
  }

  async function openCheckout(planKey: PlanKey) {
    if (planKey === "free") return;
    setError("");
    setMessage("");
    setBusy(false);
    setCheckoutPlan(planKey);
  }

  /**
   * Final pay button: product flow is complete here.
   * Live gateway is deferred — staging may enable CVSCHOLAR_BILLING_DEV_SIMULATE=1.
   */
  async function completePayment() {
    if (!checkoutPlan) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: checkoutPlan })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error || "Could not start checkout.");
        setBusy(false);
        return;
      }

      if (result.mode === "dev_simulate") {
        const sim = await fetch("/api/billing/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: result.orderId })
        });
        const simBody = await sim.json();
        if (!sim.ok) {
          setError(simBody.error || "Simulate failed.");
          setBusy(false);
          return;
        }
        await refresh();
        setMessage("Staging activate completed. Your plan is active for testing.");
        setBusy(false);
        setCheckoutPlan(null);
        return;
      }

      if (result.mode === "coming_soon") {
        setMessage(
          result.message ||
            "Checkout is ready. Secure payment will open on this button in the next release."
        );
        setBusy(false);
        return;
      }

      setError("Unknown checkout mode.");
      setBusy(false);
    } catch {
      setError("Checkout failed. Please try again.");
      setBusy(false);
    }
  }

  const statusPanel = (
    <div className="billing-status-panel">
      <div className="website-status-head">
        <strong>Your plan</strong>
        <span className={`billing-pill ${data.subscription.isPaid ? "is-paid" : "is-free"}`}>
          {data.subscription.planName}
        </span>
      </div>

      <div className="billing-status-card">
        <div className="billing-status-row">
          <CalendarDays size={16} />
          <div>
            <strong>Billing cycle</strong>
            <small>{data.subscription.cycleLabel}</small>
          </div>
        </div>
        {data.subscription.expiresAt ? (
          <div className="billing-status-row">
            <Sparkles size={16} />
            <div>
              <strong>Access until</strong>
              <small>
                {new Date(data.subscription.expiresAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric"
                })}
                {data.subscription.daysRemaining != null
                  ? ` · ${data.subscription.daysRemaining} day${data.subscription.daysRemaining === 1 ? "" : "s"} left`
                  : ""}
              </small>
            </div>
          </div>
        ) : null}
        <div className="billing-status-row">
          <Download size={16} />
          <div>
            <strong>PDF download</strong>
            <small>{data.entitlements.canDownloadPdf ? "Unlocked" : "Locked — preview free"}</small>
          </div>
        </div>
        <div className="billing-status-row">
          <Globe2 size={16} />
          <div>
            <strong>Website badge</strong>
            <small>
              {data.entitlements.showPlatformBranding
                ? "Shows “Built with CVScholar”"
                : "Hidden (Scholar Annual)"}
            </small>
          </div>
        </div>
        <div className="billing-status-row">
          <ShieldCheck size={16} />
          <div>
            <strong>Custom domain</strong>
            <small>
              {data.entitlements.canConnectCustomDomain ? "Unlocked" : "Scholar Annual only"}
            </small>
          </div>
        </div>
        <div className="billing-status-row">
          <CreditCard size={16} />
          <div>
            <strong>Credits</strong>
            <small>{data.credits} available (wallet)</small>
          </div>
        </div>
        <div className="billing-status-row">
          <ShieldCheck size={16} />
          <div>
            <strong>Payment</strong>
            <small>
              {data.payment.devSimulate
                ? "Staging simulate enabled"
                : "Gateway next — checkout stops at Pay"}
            </small>
          </div>
        </div>
      </div>

      {data.recentPayments.length > 0 ? (
        <div className="billing-recent">
          <span className="section-label">Recent payments</span>
          <ul>
            {data.recentPayments.map((p) => (
              <li key={p.id}>
                <strong>{p.planName}</strong>
                <small>
                  {p.currency} {p.amount.toFixed(2)} · {p.status}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="billing-status-hint">No payments yet. Choose a plan when you need PDF downloads.</p>
      )}
    </div>
  );

  return (
    <section className="billing-workspace">
      <div className="screen-header">
        <div>
          <h1>Billing</h1>
          <p>Build free. Pay only when you need PDF downloads or a fully branded academic website.</p>
        </div>
      </div>

      {message && !checkoutPlan ? (
        <div className="billing-banner is-success" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}
      {error && !checkoutPlan ? (
        <div className="billing-banner is-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {data.subscription.isExpiringSoon && data.subscription.expiresAt ? (
        <div className="billing-banner is-warning" role="status">
          <CalendarDays size={18} />
          <div className="billing-banner-copy">
            <strong>
              {data.subscription.planName} ends in {data.subscription.daysRemaining} day
              {data.subscription.daysRemaining === 1 ? "" : "s"}
            </strong>
            <span>
              Access until{" "}
              {new Date(data.subscription.expiresAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
              })}
              . Renew now so PDF download stays unlocked.
            </span>
          </div>
          <button
            className="primary-action compact-action"
            type="button"
            onClick={() =>
              void openCheckout(
                data.subscription.planKey === "scholar_annual" ? "scholar_annual" : "pdf_pass"
              )
            }
          >
            Renew
          </button>
        </div>
      ) : null}

      {data.subscription.justExpired ? (
        <div className="billing-banner is-warning" role="status">
          <Sparkles size={18} />
          <div className="billing-banner-copy">
            <strong>
              {data.subscription.previousPlanName || "Your paid plan"} has ended
            </strong>
            <span>
              You are back on Free: preview stays available, PDF download is locked until you renew.
            </span>
          </div>
          <button className="primary-action compact-action" type="button" onClick={() => void openCheckout("pdf_pass")}>
            Unlock PDF
          </button>
        </div>
      ) : null}

      {!data.subscription.isPaid && !data.subscription.justExpired ? (
        <div className="billing-banner is-info" role="status">
          <Download size={18} />
          <div className="billing-banner-copy">
            <strong>PDF download is locked on Free</strong>
            <span>Build and preview freely. Pay only when you need the official file.</span>
          </div>
          <button className="primary-action compact-action" type="button" onClick={() => void openCheckout("pdf_pass")}>
            Get PDF Pass
          </button>
        </div>
      ) : null}

      <div className="billing-tier-grid">
        {data.plans.map((plan) => {
          const isCurrent =
            data.subscription.planKey === plan.key ||
            (plan.key === "free" && !data.subscription.isPaid);
          const isPaidTier = plan.key !== "free";
          const cta =
            plan.key === "free"
              ? isCurrent
                ? "Current plan"
                : "Included"
              : data.subscription.planKey === plan.key && data.subscription.isPaid
                ? plan.key === "pdf_pass"
                  ? "Extend 30 days"
                  : "Renew year"
                : plan.ctaLabel;

          return (
            <article
              key={plan.key}
              className={[
                "billing-tier-card",
                plan.highlighted ? "is-highlighted" : "",
                isCurrent && isPaidTier ? "is-active" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {plan.highlighted ? <span className="billing-tier-badge">Most popular</span> : null}
              <h2>{plan.name}</h2>
              <p className="billing-tier-tagline">{plan.tagline}</p>
              <div className="billing-tier-price">
                <span className="billing-price-amount">{plan.priceLabel}</span>
                <span className="billing-price-period">{plan.periodLabel}</span>
              </div>
              <ul className="billing-feature-list">
                {plan.features.map((f) => (
                  <li key={f}>
                    <CheckCircle2 size={16} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan.key === "free" ? (
                <button className="secondary-action billing-cta" type="button" disabled>
                  {cta}
                </button>
              ) : (
                <button
                  className="primary-action billing-cta"
                  type="button"
                  onClick={() => void openCheckout(plan.key)}
                >
                  {cta}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {statusSlot ? createPortal(statusPanel, statusSlot) : null}

      {checkoutPlan && selectedPlan ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && closeCheckout()}>
          <section
            className="billing-checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-checkout-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close checkout"
              disabled={busy}
              onClick={closeCheckout}
            >
              <X size={18} />
            </button>

            <h2 id="billing-checkout-title">Complete payment</h2>
            <p className="billing-checkout-lead">
              Order summary for <strong>{selectedPlan.name}</strong>. The pay button is the last step —
              secure charging ships in a follow-up release.
            </p>

            <div className="billing-checkout-summary">
              <div className="billing-checkout-line">
                <span>Plan</span>
                <strong>{selectedPlan.name}</strong>
              </div>
              <div className="billing-checkout-line">
                <span>Duration</span>
                <strong>{selectedPlan.periodLabel}</strong>
              </div>
              <div className="billing-checkout-line billing-checkout-total">
                <span>Total</span>
                <strong>
                  {selectedPlan.priceLabel} <small>USD</small>
                </strong>
              </div>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {message ? <p className="billing-checkout-ok">{message}</p> : null}

            <button
              className="primary-action billing-pay-btn"
              type="button"
              disabled={busy}
              onClick={() => void completePayment()}
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Processing…
                </>
              ) : data.payment.devSimulate ? (
                <>
                  <Sparkles size={18} />
                  Activate {selectedPlan.priceLabel} (staging)
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Pay {selectedPlan.priceLabel} now
                </>
              )}
            </button>

            <p className="billing-checkout-secure">
              {data.payment.devSimulate
                ? "Staging mode: activates the plan without a real charge."
                : "Payment gateway not connected yet. This button is ready for the next release."}
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
