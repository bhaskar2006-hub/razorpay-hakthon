import { useState, useEffect } from "react";
import { api } from "../api";
import { Terminal, Shield, Copy, Check, Zap, Lock, Cpu } from "lucide-react";

export default function APIProtocol() {
  const [discoveryJson, setDiscoveryJson] = useState<any>(null);
  const [catalogJson, setCatalogJson] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadSpecs() {
      try {
        const resCatalog = await api.get("/catalog/ai");
        setCatalogJson(resCatalog.data);
      } catch (err) {
        console.error(err);
      }
    }
    loadSpecs();

    setDiscoveryJson({
      name: "RazorAI Agentic Commerce Gateway",
      version: "1.0.0",
      description: "Machine-readable e-commerce protocol for autonomous AI buyer agents and conversational commerce",
      protocol_version: "1.0-agentic",
      endpoints: {
        discovery: "https://razorpay-hakthon.onrender.com/.well-known/ai-commerce.json",
        catalog: "https://razorpay-hakthon.onrender.com/api/catalog/ai",
        intent: "https://razorpay-hakthon.onrender.com/api/purchase-intent",
        checkout_preview: "https://razorpay-hakthon.onrender.com/api/checkout/preview",
        checkout_approve: "https://razorpay-hakthon.onrender.com/api/checkout/approve",
        payments_verify: "https://razorpay-hakthon.onrender.com/api/payments/verify",
        webhooks: "https://razorpay-hakthon.onrender.com/api/webhooks",
        audit_logs: "https://razorpay-hakthon.onrender.com/api/audit",
      },
      constraints: {
        supported_currencies: ["INR"],
        max_single_transaction_limit_paise: 10000000,
        max_single_transaction_limit_inr: 100000,
        payment_gateway: "Razorpay Standard Checkout (Test Mode)",
        policy_engine: "Server-Enforced (Bounded, Gated, Explainable)",
        signature_verification: "HMAC SHA256",
      },
    });
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <div style={{ padding: "8px", borderRadius: "10px", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Terminal size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
              Agentic Commerce API & Machine Discovery Specs
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              Standardized JSON protocols powering Headless AI Buyers, Bounded Policy Checks, and Razorpay Cryptographic Verification.
            </p>
          </div>
        </div>
      </div>

      {/* Triad Badges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        <div className="card" style={{ borderLeft: "4px solid var(--accent-primary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>
            <Zap size={18} color="var(--accent-primary)" /> Explainable Money Actions
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Every product recommendation, dynamic upsell bundle, and fee calculation includes an explicit, inspectable rationale in the telemetry ledger.
          </p>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--success)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>
            <Shield size={18} color="var(--success)" /> Bounded Policy Engine
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Hard server-side transaction limits (≤ ₹1,00,000), verified live stock availability, and merchant-enforced category bounds prevent unauthorized charges.
          </p>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--cyan)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>
            <Lock size={18} color="var(--cyan)" /> Gated & Verified Settlement
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Two-step human approval gating generates immutable order intents before dispatching server-signed Razorpay orders with HMAC SHA256 verification.
          </p>
        </div>
      </div>

      {/* Protocol Endpoints Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Discovery Spec */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-accent">GET</span>
              <code style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 700 }}>
                /.well-known/ai-commerce.json
              </code>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 8px", fontSize: "11px" }}
              onClick={() => handleCopy(JSON.stringify(discoveryJson, null, 2), "discovery")}
            >
              {copiedKey === "discovery" ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === "discovery" ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre
            style={{
              flex: 1,
              background: "var(--bg-secondary)",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--cyan)",
              overflow: "auto",
              maxHeight: "340px",
            }}
          >
            {JSON.stringify(discoveryJson, null, 2)}
          </pre>
        </div>

        {/* Machine Readable Catalog */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="badge badge-success">GET</span>
              <code style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 700 }}>
                /api/catalog/ai
              </code>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 8px", fontSize: "11px" }}
              onClick={() => handleCopy(JSON.stringify(catalogJson, null, 2), "catalog")}
            >
              {copiedKey === "catalog" ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === "catalog" ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre
            style={{
              flex: 1,
              background: "var(--bg-secondary)",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#34d399",
              overflow: "auto",
              maxHeight: "340px",
            }}
          >
            {catalogJson ? JSON.stringify(catalogJson, null, 2) : "Loading live PostgreSQL catalog..."}
          </pre>
        </div>
      </div>

      {/* CLI Autonomous Agent Runner Demo */}
      <div className="card" style={{ background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          <Cpu size={18} color="var(--accent-primary)" /> Autonomous AI Buyer CLI Script
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
          External agents can programmatically discover, quote, and settle transactions without human UI interaction:
        </p>
        <pre
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            color: "#fbbf24",
            overflowX: "auto",
          }}
        >
{`# 1. Discover Merchant Protocol
curl https://razorpay-hakthon.onrender.com/.well-known/ai-commerce.json

# 2. Query Agent Catalog with Live Pricing
curl https://razorpay-hakthon.onrender.com/api/catalog/ai

# 3. Delegate Autonomous Purchase
curl -X POST https://razorpay-hakthon.onrender.com/api/buyer/delegate \\
  -H "Content-Type: application/json" \\
  -d '{"goal": "Buy the best gaming mouse under ₹2000", "customerId": "cmtfcc2jn0001czfr1m0knbly", "maxBudget": 200000}'`}
        </pre>
      </div>
    </div>
  );
}
