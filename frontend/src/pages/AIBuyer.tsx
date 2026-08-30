import { useState, useEffect } from "react";
import { api } from "../api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Coins,
} from "lucide-react";

export default function AIBuyer({ customerId }: { customerId?: string }) {
  const [goal, setGoal] = useState("Find a gaming laptop under ₹70,000 with a recommended accessory and prepare order");
  const [maxBudget, setMaxBudget] = useState(7000);
  const [running, setRunning] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [approvedOrder, setApprovedOrder] = useState<any>(null);

  // Autopay Mandate States
  const [mandate, setMandate] = useState({
    id: "",
    mandateActive: false,
    mandateLimitSingle: 500000,
    mandateLimitMonthly: 2000000,
    mandateSpentMonthly: 0,
    razorpayMandateToken: "",
  });
  const [updatingMandate, setUpdatingMandate] = useState(false);

  // Input fields for controls
  const [limitSingleInput, setLimitSingleInput] = useState("5000");
  const [limitMonthlyInput, setLimitMonthlyInput] = useState("20000");

  // Autonomous payment simulation progress
  const [autopayStep, setAutopayStep] = useState<"IDLE" | "CHECKING_LIMITS" | "VERIFYING_POLICY" | "CHARGING_TOKEN" | "SUCCESS" | "FAILED">("IDLE");
  const [autopayError, setAutopayError] = useState("");

  const fetchMandate = async () => {
    if (!customerId) return;
    try {
      setLoadingMandate(true);
      const res = await api.get(`/buyer/mandate/${customerId}`);
      setMandate(res.data);
      setLimitSingleInput((res.data.mandateLimitSingle / 100).toString());
      setLimitMonthlyInput((res.data.mandateLimitMonthly / 100).toString());
    } catch (err) {
      console.error("Fetch mandate error:", err);
    } finally {
      setLoadingMandate(false);
    }
  };

  useEffect(() => {
    fetchMandate();
  }, [customerId]);

  const handleUpdateMandateSettings = async (active: boolean) => {
    if (!customerId || updatingMandate) return;
    setUpdatingMandate(true);
    try {
      const single = parseFloat(limitSingleInput) * 100;
      const monthly = parseFloat(limitMonthlyInput) * 100;
      const res = await api.post("/buyer/mandate", {
        customerId,
        mandateActive: active,
        mandateLimitSingle: isNaN(single) ? 500000 : single,
        mandateLimitMonthly: isNaN(monthly) ? 2000000 : monthly,
      });
      setMandate(res.data);
    } catch (err) {
      console.error("Update mandate error:", err);
      alert("Failed to update mandate settings");
    } finally {
      setUpdatingMandate(false);
    }
  };

  // Authorize Mandate via ₹1 transaction using Razorpay Checkout
  const handleAuthorizeMandate = async () => {
    if (!customerId) return;
    try {
      setUpdatingMandate(true);
      const res = await api.post("/buyer/mandate/setup-intent", { customerId });
      
      await openRazorpayCheckout({
        orderId: res.data.orderId,
        razorpayOrderId: res.data.razorpayOrderId,
        amount: res.data.amount,
        currency: "INR",
        description: "RazorAI Agent Autopay Mandate Registration (₹1)",
        onSuccess: async (response) => {
          try {
            // Verify ₹1 payment
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            // Enable the mandate
            const mandateRes = await api.post("/buyer/mandate", {
              customerId,
              mandateActive: true,
              mandateLimitSingle: parseFloat(limitSingleInput) * 100,
              mandateLimitMonthly: parseFloat(limitMonthlyInput) * 100,
            });
            setMandate(mandateRes.data);
          } catch (err) {
            alert("Verification failed");
          }
        },
        onFailure: (err) => {
          alert(`Mandate authorization aborted: ${err?.description || "Cancelled"}`);
        }
      });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to initiate mandate registration");
    } finally {
      setUpdatingMandate(false);
    }
  };

  const handleRunBuyer = async () => {
    if (!goal.trim() || running) return;

    setRunning(true);
    setProposal(null);
    setPaymentSuccess(false);
    setAutopayStep("IDLE");
    setAutopayError("");

    try {
      const res = await api.post("/buyer/delegate", {
        goal,
        customerId,
        maxBudget: maxBudget * 100, // paise
      });

      setProposal(res.data);

      // Trigger Autonomous settlement if mandate is active and within limit
      if (mandate.mandateActive) {
        const total = res.data.totalAmount;
        const remMonthly = mandate.mandateLimitMonthly - mandate.mandateSpentMonthly;
        if (total <= mandate.mandateLimitSingle && total <= remMonthly) {
          triggerAutonomousAutopay(total);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Autonomous buyer agent encountered an error");
    } finally {
      setRunning(false);
    }
  };

  // Run autonomous settlement sequence
  const triggerAutonomousAutopay = async (expectedTotal: number) => {
    setAutopayStep("CHECKING_LIMITS");
    
    // Simulate thinking delay for telemetry effect
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setAutopayStep("VERIFYING_POLICY");
    
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setAutopayStep("CHARGING_TOKEN");
    
    try {
      const res = await api.post("/checkout/autopay", {
        customerId,
        expectedTotal,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setApprovedOrder(res.data);
      setPaymentSuccess(true);
      setAutopayStep("SUCCESS");
      fetchMandate(); // reload limits
    } catch (err: any) {
      console.error(err);
      setAutopayStep("FAILED");
      setAutopayError(err.response?.data?.message || "Autopay execution failed");
    }
  };

  const handleApproveProposalManual = async () => {
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
        description: `AI Buyer Manual Settlement: ₹${((res.data.amount || 0) / 100).toLocaleString("en-IN")}`,
        onSuccess: async (response) => {
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentSuccess(true);
            setAutopayStep("SUCCESS");
            fetchMandate(); // reload budget spent
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

  const handleResetSpent = async () => {
    if (!customerId) return;
    try {
      const res = await api.post("/buyer/mandate", {
        customerId,
        mandateActive: mandate.mandateActive,
        resetSpent: true,
      });
      setMandate(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const monthlySpent = mandate.mandateSpentMonthly / 100;
  const monthlyCap = mandate.mandateLimitMonthly / 100;
  const singleCap = mandate.mandateLimitSingle / 100;
  const progressPercent = Math.min((monthlySpent / (monthlyCap || 1)) * 100, 100);

  // Determine if proposal violates current mandate limits
  const proposalTotal = proposal?.totalAmount ? proposal.totalAmount / 100 : 0;
  const isSingleLimitExceeded = proposalTotal > singleCap;
  const isMonthlyLimitExceeded = proposalTotal > (monthlyCap - monthlySpent);
  const mandateViolated = mandate.mandateActive && (isSingleLimitExceeded || isMonthlyLimitExceeded);

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
              Autonomous AI Buyer & Spend Control Mandates
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Register a spend control mandate with Razorpay to enable autonomous settlement for low-cost transactions while safety gating larger orders.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Mandate Settings & Agent Delegation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "stretch" }}>
        
        {/* Mandate Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px", border: mandate.mandateActive ? "1px solid var(--border-accent)" : "1px solid var(--border)", background: mandate.mandateActive ? "linear-gradient(180deg, rgba(99, 102, 241, 0.03) 0%, rgba(24, 26, 34, 1) 100%)" : "var(--bg-card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Coins size={18} color={mandate.mandateActive ? "var(--accent-primary)" : "var(--text-muted)"} />
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                Razorpay Autopay Mandate
              </h3>
            </div>
            {mandate.mandateActive ? (
              <span className="badge badge-accent" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
                <Unlock size={12} style={{ marginRight: "3px" }} /> AUTOPAY ACTIVE
              </span>
            ) : (
              <span className="badge badge-danger">
                <Lock size={12} style={{ marginRight: "3px" }} /> MANUAL GATED
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-secondary)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Single Tx Limit</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>₹</span>
                  <input
                    type="number"
                    value={limitSingleInput}
                    onChange={(e) => setLimitSingleInput(e.target.value)}
                    disabled={mandate.mandateActive}
                    style={{ width: "100%", background: mandate.mandateActive ? "transparent" : "var(--bg-card)", border: mandate.mandateActive ? "none" : "1px solid var(--border)", color: "white", fontWeight: 700, padding: "3px 6px", borderRadius: "4px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Monthly Budget</label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>₹</span>
                  <input
                    type="number"
                    value={limitMonthlyInput}
                    onChange={(e) => setLimitMonthlyInput(e.target.value)}
                    disabled={mandate.mandateActive}
                    style={{ width: "100%", background: mandate.mandateActive ? "transparent" : "var(--bg-card)", border: mandate.mandateActive ? "none" : "1px solid var(--border)", color: "white", fontWeight: 700, padding: "3px 6px", borderRadius: "4px" }}
                  />
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Monthly Budget Utilized</span>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>₹{monthlySpent.toLocaleString()} / ₹{monthlyCap.toLocaleString()}</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--bg-card)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--accent-gradient)", borderRadius: "3px" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
            {mandate.mandateActive ? (
              <>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={() => handleUpdateMandateSettings(false)}
                  disabled={updatingMandate}
                >
                  Disable Autopay
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "12px", padding: "8px 12px" }}
                  onClick={handleResetSpent}
                >
                  Reset Budget
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: "13px", background: "var(--accent-gradient)", boxShadow: "0 0 15px rgba(99, 102, 241, 0.4)" }}
                onClick={handleAuthorizeMandate}
                disabled={updatingMandate}
              >
                {updatingMandate ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                Authenticate & Setup Autopay Mandate (₹1)
              </button>
            )}
          </div>
        </div>

        {/* Goal Delegation Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Cpu size={18} color="var(--cyan)" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              Delegate Goal to AI Agent
            </h3>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
              Target Purchase instructions:
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Find the best gaming laptop under ₹70,000..."
              style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", color: "white", fontSize: "13px", outline: "none", resize: "none" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Budget cap:</span>
              <input
                type="number"
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
                style={{ width: "100px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 8px", color: "white", fontSize: "13px", fontWeight: 700 }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>INR</span>
            </div>

            <button className="btn btn-primary" onClick={handleRunBuyer} disabled={running}>
              {running ? <RefreshCw size={14} className="animate-spin" /> : <Cpu size={14} />}
              {running ? "Analyzing catalog..." : "Run AI Buyer"}
            </button>
          </div>
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

      {/* Autopay Processing Progress */}
      {autopayStep !== "IDLE" && autopayStep !== "SUCCESS" && autopayStep !== "FAILED" && (
        <div className="card animate-pulse" style={{ border: "1px solid var(--border-accent)", background: "rgba(99, 102, 241, 0.08)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#818cf8" }}>
            <RefreshCw size={16} className="animate-spin" />
            <span>🔒 Autopay Mandate Active — Settle Autonomously</span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {autopayStep === "CHECKING_LIMITS" && "⚡ Step 1: Checking mandate limits (₹" + proposalTotal.toLocaleString() + " vs ₹" + singleCap.toLocaleString() + " cap)..."}
            {autopayStep === "VERIFYING_POLICY" && "⚖️ Step 2: Validating transaction via Merchant Central Policy Engine..."}
            {autopayStep === "CHARGING_TOKEN" && "💳 Step 3: Debiting Saved Payment Instrument Mandate Token via Razorpay TokenHQ..."}
          </div>
        </div>
      )}

      {/* Autopay failure */}
      {autopayStep === "FAILED" && (
        <div className="card" style={{ border: "1px solid var(--danger)", background: "var(--danger-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontWeight: 700 }}>
            <AlertTriangle size={16} />
            <span>Autonomous Settlement Blocked</span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "4px" }}>{autopayError}</p>
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
            {paymentSuccess ? (
              <span className="badge badge-success">
                <ShieldCheck size={12} style={{ marginRight: "3px" }} /> SETTLED AUTONOMOUSLY
              </span>
            ) : mandateViolated ? (
              <span className="badge badge-warning">
                <AlertTriangle size={12} style={{ marginRight: "3px" }} /> MANDATE LIMIT VIOLATION
              </span>
            ) : mandate.mandateActive ? (
              <span className="badge badge-accent">
                <Coins size={12} style={{ marginRight: "3px" }} /> AUTOPAY APPLICABLE
              </span>
            ) : (
              <span className="badge badge-warning">
                <Lock size={12} style={{ marginRight: "3px" }} /> MANUAL GATED APPROVAL
              </span>
            )}
          </div>

          {/* Limit Violation Warning */}
          {mandateViolated && (
            <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "12px", borderRadius: "8px", fontSize: "13px", color: "var(--warning)", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "16px" }}>
              <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={15} />
                Mandate Spending Limits Exceeded
              </div>
              <div>
                {isSingleLimitExceeded && `This purchase (₹${proposalTotal.toLocaleString()}) exceeds your single-order spending cap of ₹${singleCap.toLocaleString()}. `}
                {isMonthlyLimitExceeded && `This purchase (₹${proposalTotal.toLocaleString()}) exceeds your remaining monthly budget of ₹${(monthlyCap - monthlySpent).toLocaleString()}. `}
                Autonomous settlement is blocked. Falling back to explicit human gated approval.
              </div>
            </div>
          )}

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
                {mandateViolated 
                  ? "Limits exceeded. Explicit checkout authorization is required to pay."
                  : "Mandate Autopay is inactive. Authorize purchase to complete order."}
              </div>
              <button className="btn btn-primary" onClick={handleApproveProposalManual}>
                <CheckCircle2 size={16} /> Approve & Checkout (Razorpay)
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(16, 185, 129, 0.15)", padding: "16px", borderRadius: "8px", border: "1px solid var(--success)", textAlign: "center" }}>
              <CheckCircle2 size={32} color="var(--success)" style={{ margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                AI Buyer Order Settled Successfully!
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Attribution: <strong>{mandate.mandateActive && !mandateViolated ? "AI_BUYER (AUTOPAY)" : "AI_BUYER (MANUAL GATED)"}</strong>
              </div>
              {approvedOrder?.paymentId && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Razorpay Reference ID: <code>{approvedOrder.paymentId}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
