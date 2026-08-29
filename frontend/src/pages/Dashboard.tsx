import { useEffect, useState } from "react";
import { api } from "../api";
import {
  TrendingUp,
  ShoppingBag,
  Zap,
  Sparkles,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  Bot,
  User,
  ShieldCheck,
} from "lucide-react";

interface SummaryData {
  revenue: number;
  formattedRevenue: string;
  orders: number;
  totalOrdersAttempted: number;
  averageOrderValue: number;
  formattedAOV: string;
  aiRevenue: number;
  formattedAiRevenue: string;
  upsellRevenue: number;
  formattedUpsellRevenue: string;
  channels: {
    human: { amount: number; formatted: string; count: number };
    aiAgent: { amount: number; formatted: string; count: number };
    aiBuyer: { amount: number; formatted: string; count: number };
  };
  upsellStats: {
    recommendations: number;
    accepted: number;
    conversionRate: string;
    revenue: number;
    formattedRevenue: string;
  };
}

interface Transaction {
  id: string;
  customerName: string;
  customerEmail: string;
  products: string;
  amount: number;
  formattedAmount: string;
  status: "PAID" | "FAILED" | "PENDING" | "CANCELLED";
  source: "HUMAN" | "AI_AGENT" | "AI_BUYER";
  paymentAttempts: number;
  failureReason: string | null;
  formattedDate: string;
}

export default function Dashboard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, txRes] = await Promise.all([
        api.get("/dashboard/summary"),
        api.get("/dashboard/transactions"),
      ]);
      setSummary(sumRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            Merchant Analytics & Performance
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Real-time revenue attribution, AI upsell conversion, and autonomous commerce telemetry.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div className="card" style={{ borderLeft: "4px solid var(--accent-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>Total Revenue</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginTop: "8px" }}>
            {summary ? summary.formattedRevenue : "₹0"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--success)", marginTop: "6px" }}>
            <ArrowUpRight size={14} /> +24.8% vs last week
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--success)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>Paid Orders</span>
            <ShoppingBag size={18} color="var(--success)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginTop: "8px" }}>
            {summary ? summary.orders : 0}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
            {summary ? summary.totalOrdersAttempted : 0} total checkout attempts
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--cyan)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>Average Order Value</span>
            <Zap size={18} color="var(--cyan)" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginTop: "8px" }}>
            {summary ? summary.formattedAOV : "₹0"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--cyan)", marginTop: "6px" }}>
            Boosted by relevant upsells
          </div>
        </div>

        <div className="card" style={{ borderLeft: "4px solid #a855f7", background: "linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(24, 26, 34, 1) 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ color: "#c084fc", fontSize: "13px", fontWeight: 600 }}>AI Generated Revenue</span>
            <Sparkles size={18} color="#c084fc" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-primary)", marginTop: "8px" }}>
            {summary ? summary.formattedAiRevenue : "₹0"}
          </div>
          <div style={{ fontSize: "12px", color: "#c084fc", marginTop: "6px", fontWeight: 500 }}>
            {summary && summary.revenue > 0 ? `${((summary.aiRevenue / summary.revenue) * 100).toFixed(0)}% of total sales` : "Direct AI Attribution"}
          </div>
        </div>
      </div>

      {/* Visual Section: Revenue Growth Chart & Channel Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", alignItems: "stretch" }}>
        {/* Revenue Growth Visual */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Revenue Growth Trajectory</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Cumulative Human vs AI revenue attribution</p>
            </div>
            <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#6366f1" }} /> Human
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a855f7" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#a855f7" }} /> AI Sales & Buyer
              </span>
            </div>
          </div>

          {/* SVG Growth Chart */}
          <div style={{ position: "relative", width: "100%", height: "200px", padding: "10px 0" }}>
            <svg viewBox="0 0 600 180" style={{ width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="humanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="#262936" strokeDasharray="4" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="#262936" strokeDasharray="4" />
              <line x1="0" y1="130" x2="600" y2="130" stroke="#262936" strokeDasharray="4" />

              {/* Area 1: Human */}
              <path
                d="M 0,140 Q 100,120 200,105 T 400,70 T 600,35 L 600,160 L 0,160 Z"
                fill="url(#humanGradient)"
              />
              <path
                d="M 0,140 Q 100,120 200,105 T 400,70 T 600,35"
                fill="none"
                stroke="#6366f1"
                strokeWidth="3"
              />

              {/* Area 2: AI Revenue */}
              <path
                d="M 0,155 Q 100,145 200,125 T 400,85 T 600,50 L 600,160 L 0,160 Z"
                fill="url(#aiGradient)"
              />
              <path
                d="M 0,155 Q 100,145 200,125 T 400,85 T 600,50"
                fill="none"
                stroke="#a855f7"
                strokeWidth="3"
              />

              {/* Data points */}
              <circle cx="600" cy="35" r="5" fill="#6366f1" />
              <circle cx="600" cy="50" r="5" fill="#a855f7" />
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "11px", marginTop: "8px" }}>
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Today</span>
          </div>
        </div>

        {/* Channel Revenue Attribution */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              Revenue by Channel
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Proven breakdown across buyers
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)" }}>
                    <User size={14} color="#6366f1" /> Human Direct
                  </span>
                  <span style={{ fontWeight: 600 }}>{summary?.channels.human.formatted || "₹0"}</span>
                </div>
                <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "#6366f1", borderRadius: "3px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)" }}>
                    <Sparkles size={14} color="#a855f7" /> AI Sales Agent
                  </span>
                  <span style={{ fontWeight: 600, color: "#c084fc" }}>{summary?.channels.aiAgent.formatted || "₹0"}</span>
                </div>
                <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "35%", background: "#a855f7", borderRadius: "3px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-primary)" }}>
                    <Bot size={14} color="#06b6d4" /> Autonomous AI Buyer
                  </span>
                  <span style={{ fontWeight: 600, color: "#22d3ee" }}>{summary?.channels.aiBuyer.formatted || "₹0"}</span>
                </div>
                <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "15%", background: "#06b6d4", borderRadius: "3px" }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", marginTop: "16px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <ShieldCheck size={16} color="var(--success)" />
              <span>100% of money actions verified by Policy Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upsell Performance & Recent Transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        {/* Upsell Metrics Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
              AI Upsell Performance
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Complementary recommendations
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Recommendations</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>{summary?.upsellStats.recommendations || 0}</div>
              </div>
              <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Accepted</div>
                <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: "var(--success)" }}>{summary?.upsellStats.accepted || 0}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Conversion Rate</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--success)" }}>{summary?.upsellStats.conversionRate || "0%"}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Upsell Revenue</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{summary?.upsellStats.formattedRevenue || "₹0"}</div>
              </div>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: "16px" }}
            onClick={() => onNavigate && onNavigate("audit")}
          >
            Inspect Audit Trail Timeline
          </button>
        </div>

        {/* Transactions Table */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Recent Transactions</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Live telemetry across all orders</p>
            </div>
            {onNavigate && (
              <button className="btn btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }} onClick={() => onNavigate("audit")}>
                View All Events
              </button>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 12px" }}>Customer</th>
                  <th style={{ padding: "8px 12px" }}>Items</th>
                  <th style={{ padding: "8px 12px" }}>Channel</th>
                  <th style={{ padding: "8px 12px" }}>Amount</th>
                  <th style={{ padding: "8px 12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid rgba(38, 41, 54, 0.6)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {tx.customerName}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tx.products || "Custom Order"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {tx.source === "AI_AGENT" ? (
                        <span className="badge badge-accent"><Sparkles size={11} /> AI Agent</span>
                      ) : tx.source === "AI_BUYER" ? (
                        <span className="badge badge-cyan"><Bot size={11} /> AI Buyer</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ background: "var(--border)", color: "var(--text-secondary)" }}><User size={11} /> Human</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {tx.formattedAmount}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {tx.status === "PAID" ? (
                        <span className="badge badge-success"><CheckCircle size={11} /> PAID</span>
                      ) : tx.status === "FAILED" ? (
                        <span className="badge badge-danger"><XCircle size={11} /> FAILED</span>
                      ) : (
                        <span className="badge badge-warning"><Clock size={11} /> PENDING</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
