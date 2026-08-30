import { useState } from "react";
import { api } from "../api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  Lock,
  RefreshCw,
  Cpu,
} from "lucide-react";

export default function AIBuyer({ customerId }: { customerId?: string }) {
  const [goal, setGoal] = useState("Find a gaming laptop under ₹70,000 with a recommended accessory and prepare order");
  const [maxBudget, setMaxBudget] = useState(70000);
  const [running, setRunning] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [approvedOrder, setApprovedOrder] = useState<any>(null);

  const handleRunBuyer = async () => {
    if (!goal.trim() || running) return;

    setRunning(true);
    setProposal(null);
    setPaymentSuccess(false);

    try {
      const res = await api.post("/buyer/delegate", {
        goal,
        customerId,
        maxBudget: maxBudget * 100, // paise
      });

      setProposal(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || "Autonomous buyer agent encountered an error");
    } finally {
      setRunning(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!proposal?.cart?.total) return;

    try {
      const res = await api.post("/checkout/approve", {
        customerId,
        userApproved: true,
        expectedTotal: proposal.cart.total,
      });

      setApprovedOrder(res.data);

      await openRazorpayCheckout({
        orderId: res.data.orderId,
        razorpayOrderId: res.data.razorpayOrderId,
        amount: res.data.amount,
        currency: res.data.currency || "INR",
        description: `AI Buyer Proposal: ₹${((res.data.amount || 0) / 100).toLocaleString("en-IN")}`,
        onSuccess: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentSuccess(true);
          } catch (err: any) {
            alert(err.response?.data?.message || "Payment verification failed");
          }
        },
        onFailure: (err) => {
          alert(`Payment failed: ${err?.description || "Transaction cancelled"}`);
        },
      });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to process proposal approval");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "960px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div style={{ padding: "8px", borderRadius: "10px", background: "var(--cyan-bg)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
            <Bot size={24} color="var(--cyan)" />
          </div>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
              Autonomous AI Buyer (Agent-to-Agent Commerce)
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Delegate purchasing tasks to an autonomous proxy buyer agent that navigates the merchant catalog, negotiates bundles, and prepares gated purchase proposals.
            </p>
          </div>
        </div>
      </div>

      {/* Goal Input Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
            Delegate Purchase Goal & Intent:
          </label>
          <textarea
            rows={2}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Find the best gaming laptop under ₹70k with a mouse..."
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "white",
              fontSize: "14px",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Strict Budget Cap:</span>
            <input
              type="number"
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
              style={{
                width: "130px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px 10px",
                color: "white",
                fontSize: "14px",
                fontWeight: 700,
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>(INR)</span>
          </div>

          <button className="btn btn-primary" onClick={handleRunBuyer} disabled={running}>
            {running ? <RefreshCw size={16} className="animate-spin" /> : <Cpu size={16} />}
            {running ? "Autonomous Agent Executing..." : "Deploy AI Buyer Agent"}
          </button>
        </div>
      </div>

      {/* Execution Telemetry Trace */}
      {running && (
        <div className="card" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--cyan)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "var(--cyan)", marginBottom: "12px" }}>
            <RefreshCw size={16} className="animate-spin" /> Autonomous Execution Telemetry
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
            <div>1. <code>GET /api/catalog/ai</code> — Querying structured machine-readable catalog...</div>
            <div>2. Filtering products by budget threshold (≤ ₹{maxBudget.toLocaleString("en-IN")})...</div>
            <div>3. Evaluating complementary upsell accessories via <code>recommend_upsell</code>...</div>
            <div>4. Populating cart & generating bounded purchase intent...</div>
          </div>
        </div>
      )}

      {/* Generated Purchase Proposal */}
      {proposal && (
        <div className="card" style={{ border: "1px solid var(--border-accent)", background: "linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(24, 26, 34, 1) 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                AI Buyer Purchase Proposal
              </h3>
            </div>
            <span className="badge badge-warning">
              <Lock size={12} /> Authorization Pending
            </span>
          </div>

          {/* Proposal Explanation */}
          <div style={{ background: "var(--bg-secondary)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "14px", lineHeight: 1.6, marginBottom: "16px", whiteSpace: "pre-wrap" }}>
            {proposal.message || proposal.summary}
          </div>

          {/* Cart Items Table */}
          <div style={{ background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border)", padding: "12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
              Selected Line Items
            </div>
            {proposal.cart?.items?.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "13px" }}>
                <span>{item.product.name} × {item.quantity}</span>
                <span style={{ fontWeight: 700 }}>₹{((item.product.price * item.quantity) / 100).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", marginTop: "4px", fontSize: "16px", fontWeight: 800 }}>
              <span>Total Proposal Amount:</span>
              <span style={{ color: "var(--success)" }}>{proposal.formattedTotal}</span>
            </div>
          </div>

          {/* User Approval Decision */}
          {!paymentSuccess ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16, 185, 129, 0.08)", padding: "14px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                The AI Buyer has stayed within budget. Do you authorize this order?
              </div>
              <button className="btn btn-primary" onClick={handleApproveProposal}>
                <CheckCircle2 size={16} /> Approve & Checkout (Razorpay)
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(16, 185, 129, 0.15)", padding: "16px", borderRadius: "8px", border: "1px solid var(--success)", textAlign: "center" }}>
              <CheckCircle2 size={32} color="var(--success)" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                AI Buyer Order Approved & Paid!
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Razorpay Order: <code>{approvedOrder?.razorpayOrderId}</code> | Attribution: <strong>AI_BUYER</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
