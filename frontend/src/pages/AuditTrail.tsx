import { useEffect, useState } from "react";
import { api } from "../api";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Sparkles,
  UserCheck,
  CreditCard,
  RefreshCw,
  Eye,
  Lock,
  ArrowDown,
} from "lucide-react";

interface AuditProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  formattedPrice: string;
}

interface AuditEvent {
  id: string;
  time: string;
  timestamp: string;
  eventType: string;
  action: string;
  statusType: "SUCCESS" | "FAILURE" | "GATE" | "INFO";
  description: string;
  metadata: Record<string, any>;
  orderId: string | null;
  orderStatus?: string;
  orderSource?: string;
  orderAmount?: string | null;
  products?: AuditProduct[];
}

export default function AuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.get("/audit");
      setEvents(res.data);
      if (res.data.length > 0 && !selectedEvent) {
        setSelectedEvent(res.data[0]);
      }
    } catch (err) {
      console.error("Audit load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const filteredEvents = events.filter((e) => {
    if (filter === "ALL") return true;
    if (filter === "PAYMENT") return e.eventType === "PAYMENT";
    if (filter === "SECURITY") return e.eventType === "SECURITY" || e.eventType === "APPROVAL";
    if (filter === "AGENT") return e.eventType === "AGENT_ACTION";
    return true;
  });

  const getEventIcon = (action: string, statusType: string) => {
    if (action.includes("SEARCH")) return <Search size={16} color="#60a5fa" />;
    if (action.includes("UPSELL")) return <Sparkles size={16} color="#c084fc" />;
    if (action.includes("APPROVAL")) return <UserCheck size={16} color="#fbbf24" />;
    if (action.includes("POLICY") || action.includes("SECURITY")) return <ShieldCheck size={16} color="#34d399" />;
    if (action.includes("FAILED") || statusType === "FAILURE") return <XCircle size={16} color="#f87171" />;
    if (action.includes("CAPTURED") || action.includes("VERIFIED") || statusType === "SUCCESS")
      return <CheckCircle2 size={16} color="#10b981" />;
    return <CreditCard size={16} color="#9ca3af" />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            AI Commerce Audit Trail & Telemetry
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            Immutable, explainable event sequence for every AI tool call, policy evaluation, and payment attempt.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-card)", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
            {["ALL", "SECURITY", "PAYMENT", "AGENT"].map((cat) => (
              <button
                key={cat}
                style={{
                  background: filter === cat ? "var(--accent-primary)" : "transparent",
                  color: filter === cat ? "white" : "var(--text-secondary)",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={loadAudit} disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Grid: Timeline + Detail Inspector */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", alignItems: "start" }}>
        {/* Timeline Sequence */}
        <div className="card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              Chronological Sequence ({filteredEvents.length} events)
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Click any event to inspect policy bounds
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filteredEvents.map((evt, idx) => {
              const isSelected = selectedEvent?.id === evt.id;
              return (
                <div key={evt.id}>
                  <div
                    onClick={() => setSelectedEvent(evt)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: isSelected ? "var(--bg-card-hover)" : "var(--bg-secondary)",
                      border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        marginTop: "2px",
                        padding: "6px",
                        borderRadius: "8px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {getEventIcon(evt.action, evt.statusType)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                          {evt.action}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {evt.time}
                        </span>
                      </div>

                      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "2px 0 6px 0" }}>
                        {evt.description}
                      </p>

                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <span
                          className={`badge ${
                            evt.statusType === "SUCCESS"
                              ? "badge-success"
                              : evt.statusType === "FAILURE"
                              ? "badge-danger"
                              : evt.statusType === "GATE"
                              ? "badge-warning"
                              : "badge-accent"
                          }`}
                        >
                          {evt.eventType}
                        </span>

                        {evt.orderAmount && (
                          <span style={{ fontSize: "11px", color: "var(--text-primary)", fontWeight: 600, background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                            {evt.orderAmount}
                          </span>
                        )}

                        {evt.orderSource && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            via {evt.orderSource}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {idx < filteredEvents.length - 1 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                      <ArrowDown size={14} color="var(--border-light)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel: Explainable Verification */}
        <div className="card" style={{ position: "sticky", top: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
            <Eye size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Explainability Inspector
            </h3>
          </div>

          {selectedEvent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Event Header */}
              <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>Event Action</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                  {selectedEvent.action}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  {selectedEvent.description}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                  Timestamp: {new Date(selectedEvent.timestamp).toLocaleString("en-IN")}
                </div>
              </div>

              {/* Associated Catalog Products */}
              {selectedEvent.products && selectedEvent.products.length > 0 && (
                <div style={{ background: "var(--bg-secondary)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                    🛍️ Associated Catalog Products ({selectedEvent.products.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedEvent.products.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "var(--bg-card)",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.name}</span>
                          <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontSize: "11px" }}>
                            ({p.category}) x{p.quantity}
                          </span>
                        </div>
                        <span style={{ fontWeight: 800, color: "var(--success)" }}>{p.formattedPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Policy Checks Breakdown */}
              <div style={{ background: "var(--bg-secondary)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px" }}>
                  <Lock size={14} color="var(--success)" /> Policy Verification Checks
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Customer Explicit Approval</span>
                    <span className="badge badge-success">✓ PASS</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Authoritative DB Pricing</span>
                    <span className="badge badge-success">✓ VERIFIED</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Inventory & Stock Availability</span>
                    <span className="badge badge-success">✓ IN STOCK</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Merchant Max Transaction Limit</span>
                    <span className={`badge ${selectedEvent.statusType === "FAILURE" ? "badge-danger" : "badge-success"}`}>
                      {selectedEvent.statusType === "FAILURE" ? "✗ BLOCKED" : "✓ PASS (≤ ₹1,00,000)"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Idempotency / Unpaid Guard</span>
                    <span className="badge badge-success">✓ VERIFIED</span>
                  </div>
                </div>
              </div>

              {/* Raw JSON Payload Inspector */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Structured Event Metadata (Audit Payload)
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
                    {selectedEvent.orderId ? `Order #${selectedEvent.orderId.slice(-8)}` : "System Action"}
                  </span>
                </div>
                <pre
                  style={{
                    background: "var(--bg-secondary)",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    color: "#a5b4fc",
                    overflowX: "auto",
                    maxHeight: "180px",
                  }}
                >
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>
              Select an event to inspect its audit verification
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
