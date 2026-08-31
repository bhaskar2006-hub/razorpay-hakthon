import { useState, useEffect } from "react";
import { api } from "../api";
import { openRazorpayCheckout } from "../lib/razorpay";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  CreditCard,
  User,
  Zap,
} from "lucide-react";

interface GrowthOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  type: "UPSELL" | "CROSS_SELL" | "REACTIVATION";
  title: string;
  targetProductId: string;
  targetProductName: string;
  targetProductPrice: number;
  discountPercent: number;
  finalPrice: number;
  expectedRevenue: number;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  whyExplanation: string;
  whatExplanation: string;
  recommendedAction: string;
  policyStatus: "PASS_AUTOMATIC" | "REQUIRES_APPROVAL" | "BLOCKED";
  policyReason: string;
  recentPurchases: string[];
  totalPastSpend: number;
  status: "OPEN" | "APPROVED" | "EXECUTED" | "DISMISSED";
  razorpayOrderId?: string;
  paymentLinkUrl?: string;
}

interface Metrics {
  totalRevenue: number;
  formattedTotalRevenue: string;
  aiGeneratedRevenue: number;
  formattedAiGeneratedRevenue: string;
  potentialRevenue: number;
  formattedPotentialRevenue: string;
  activeOpportunitiesCount: number;
  pendingApprovalsCount: number;
  safeAutomaticCount: number;
  conversionRate: number;
}

export default function GrowthOpportunities({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [opportunities, setOpportunities] = useState<GrowthOpportunity[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [activeModalLink, setActiveModalLink] = useState<{ url: string; orderId: string; productName: string; amount: number } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [executedOppIds, setExecutedOppIds] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [oppsRes, metricsRes] = await Promise.all([
        api.get("/growth/opportunities"),
        api.get("/growth/metrics"),
      ]);
      setOpportunities(oppsRes.data);
      setMetrics(metricsRes.data);
    } catch (err) {
      console.error("Failed to fetch growth data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExecute = async (opp: GrowthOpportunity, mode: "checkout" | "link") => {
    try {
      setExecutingId(opp.id);
      const res = await api.post("/growth/execute", {
        opportunityId: opp.id,
        customerId: opp.customerId,
        productId: opp.targetProductId,
        price: opp.finalPrice,
      });

      if (mode === "link") {
        setActiveModalLink({
          url: res.data.paymentLinkUrl,
          orderId: res.data.orderId,
          productName: res.data.productName,
          amount: res.data.amount,
        });
        setExecutedOppIds((prev) => ({ ...prev, [opp.id]: true }));
        fetchData();
      } else {
        // Mode === "checkout": Open live Razorpay modal
        await openRazorpayCheckout({
          orderId: res.data.orderId,
          razorpayOrderId: res.data.razorpayOrderId,
          amount: res.data.amount,
          currency: "INR",
          name: "RazorAI Growth Offer",
          description: `${opp.type} Offer: ${opp.targetProductName}`,
          customerName: opp.customerName,
          customerEmail: opp.customerEmail,
          onSuccess: async (_verifyRes) => {
            setExecutedOppIds((prev) => ({ ...prev, [opp.id]: true }));
            alert(`🎉 Payment Verified! RazorAI generated ₹${(opp.finalPrice / 100).toLocaleString("en-IN")} additional revenue!`);
            fetchData();
          },
          onFailure: (failRes) => {
            alert(`Payment cancelled or declined. ${failRes.message || ""}`);
            fetchData();
          },
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to execute growth action");
    } finally {
      setExecutingId(null);
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "UPSELL") return opp.type === "UPSELL";
    if (activeFilter === "CROSS_SELL") return opp.type === "CROSS_SELL";
    if (activeFilter === "REACTIVATION") return opp.type === "REACTIVATION";
    if (activeFilter === "APPROVAL_REQUIRED") return opp.policyStatus === "REQUIRES_APPROVAL";
    if (activeFilter === "SAFE_AUTOMATIC") return opp.policyStatus === "PASS_AUTOMATIC";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header & Subtitle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="badge badge-accent" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
              <Sparkles size={12} /> Autonomous Revenue Growth Engine
            </span>
            <span className="badge badge-success" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--success)" }}>
              <ShieldCheck size={12} /> Policy Guardrails Active
            </span>
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Growth Opportunities & Upsell Pipeline
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            AI analyzes customer purchase behavior, identifies high-confidence revenue opportunities, enforces bounded financial policies, and executes bounded Razorpay orders.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchData} disabled={loading} style={{ gap: "6px" }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh Pipeline
        </button>
      </div>

      {/* KPI Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="card" style={{ borderLeft: "4px solid #818cf8" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Potential Additional Revenue
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#818cf8", marginTop: "4px" }}>
            {metrics?.formattedPotentialRevenue || "₹0"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Across {opportunities.length} active customer opportunities
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--success)" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Revenue Generated by RazorAI
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--success)", marginTop: "4px" }}>
            {metrics?.formattedAiGeneratedRevenue || "₹0"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Verified via HMAC SHA256 Signature
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Pending Merchant Approvals
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--warning)", marginTop: "4px" }}>
            {metrics?.pendingApprovalsCount ?? 0}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Transactions &gt; ₹2,000 requiring 1-click authorization
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--cyan)" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Autonomous Safe Actions
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--cyan)", marginTop: "4px" }}>
            {metrics?.safeAutomaticCount ?? 0}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Bounded within ≤15% discount &amp; budget limits
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", background: "var(--bg-card)", padding: "10px", borderRadius: "10px", border: "1px solid var(--border)" }}>
        {[
          { id: "ALL", label: `All Opportunities (${opportunities.length})` },
          { id: "UPSELL", label: "🎯 Upsell" },
          { id: "CROSS_SELL", label: "🔗 Cross-sell" },
          { id: "REACTIVATION", label: "⚡ Reactivation" },
          { id: "APPROVAL_REQUIRED", label: "🛡️ Needs Merchant Approval" },
          { id: "SAFE_AUTOMATIC", label: "✅ Safe Automatic" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            style={{
              background: activeFilter === tab.id ? "var(--accent-primary)" : "var(--bg-secondary)",
              color: activeFilter === tab.id ? "white" : "var(--text-secondary)",
              border: activeFilter === tab.id ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Opportunities List */}
      {filteredOpportunities.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>No opportunities match this filter.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredOpportunities.map((opp) => {
            const isExecuted = executedOppIds[opp.id];
            const isExecuting = executingId === opp.id;

            return (
              <div
                key={opp.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  border: isExecuted ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border)",
                  background: isExecuted ? "linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, var(--bg-card) 100%)" : "var(--bg-card)",
                }}
              >
                {/* Header Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={18} color="var(--accent-primary)" />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {opp.customerName}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          ({opp.customerEmail})
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Past Spend: <strong>₹{(opp.totalPastSpend / 100).toLocaleString("en-IN")}</strong> • Purchased: {opp.recentPurchases.join(", ") || "None"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="badge"
                      style={{
                        background: opp.type === "UPSELL" ? "rgba(168, 85, 247, 0.15)" : opp.type === "CROSS_SELL" ? "rgba(6, 182, 212, 0.15)" : "rgba(16, 185, 129, 0.15)",
                        color: opp.type === "UPSELL" ? "#c084fc" : opp.type === "CROSS_SELL" ? "var(--cyan)" : "var(--success)",
                        border: `1px solid ${opp.type === "UPSELL" ? "rgba(168, 85, 247, 0.3)" : opp.type === "CROSS_SELL" ? "rgba(6, 182, 212, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        fontWeight: 700,
                      }}
                    >
                      {opp.type}
                    </span>
                    <span className="badge badge-accent">
                      {opp.confidence}% Confidence
                    </span>
                  </div>
                </div>

                {/* Explainability Grid: WHY, WHAT, EXPECTED IMPACT */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", background: "var(--bg-secondary)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                      🔍 Why this opportunity?
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      {opp.whyExplanation}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                      📦 Recommended Offer (What)
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      <strong>{opp.targetProductName}</strong> at <strong>₹{(opp.finalPrice / 100).toLocaleString("en-IN")}</strong>{" "}
                      <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: "12px" }}>
                        ₹{(opp.targetProductPrice / 100).toLocaleString("en-IN")}
                      </span>{" "}
                      <span style={{ color: "var(--success)", fontWeight: 700, fontSize: "12px" }}>
                        ({opp.discountPercent}% off)
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                      📈 Expected Impact
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--success)" }}>
                      +₹{(opp.expectedRevenue / 100).toLocaleString("en-IN")} Revenue
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Risk Level: <strong style={{ color: "var(--success)" }}>{opp.riskLevel}</strong>
                    </div>
                  </div>
                </div>

                {/* Policy Guardrail Gate & Action Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "600px" }}>
                    {opp.policyStatus === "REQUIRES_APPROVAL" ? (
                      <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                    ) : (
                      <ShieldCheck size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      <strong style={{ color: opp.policyStatus === "REQUIRES_APPROVAL" ? "var(--warning)" : "var(--success)" }}>
                        {opp.policyStatus === "REQUIRES_APPROVAL" ? "Merchant Approval Required: " : "Policy Gate: "}
                      </strong>
                      {opp.policyReason}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {isExecuted ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--success)", fontSize: "13px", fontWeight: 700 }}>
                        <CheckCircle2 size={16} /> Action Executed
                      </div>
                    ) : (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleExecute(opp, "link")}
                          disabled={isExecuting}
                          style={{ padding: "8px 12px", fontSize: "12px" }}
                        >
                          <QrCode size={14} /> Generate Payment Link &amp; QR
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleExecute(opp, "checkout")}
                          disabled={isExecuting}
                          style={{ padding: "8px 16px", fontSize: "12px", background: "var(--accent-gradient)" }}
                        >
                          {isExecuting ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                          {isExecuting ? "Preparing..." : opp.policyStatus === "REQUIRES_APPROVAL" ? "Approve & Test Pay" : "⚡ 1-Click Pay"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shareable Link Modal */}
      {activeModalLink && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={18} color="#818cf8" />
                Razorpay Growth Payment Link
              </div>
              <button
                onClick={() => setActiveModalLink(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>
              Generated authenticated test checkout link for <strong>{activeModalLink.productName}</strong> (₹{(activeModalLink.amount / 100).toLocaleString("en-IN")}). Send this short link to the customer or scan to pay with a phone.
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input
                type="text"
                value={activeModalLink.url}
                readOnly
                style={{
                  flex: 1,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  padding: "8px 12px",
                  color: "var(--cyan)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(activeModalLink.url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
              >
                {copiedLink ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{ background: "white", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(activeModalLink.url)}&size=140x140`}
                  alt="QR Code"
                  style={{ width: "140px", height: "140px" }}
                />
                <div style={{ fontSize: "11px", color: "#374151", fontWeight: 700, marginTop: "6px" }}>
                  Scan to Pay on Mobile
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setActiveModalLink(null);
                  if (onNavigate) onNavigate("audit");
                }}
              >
                View in Audit Trail &rarr;
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setActiveModalLink(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
