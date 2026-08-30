import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import AISales from "./pages/AISales";
import AIBuyer from "./pages/AIBuyer";
import AuditTrail from "./pages/AuditTrail";
import Products from "./pages/Products";
import APIProtocol from "./pages/APIProtocol";
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  Package,
  ShieldCheck,
  Zap,
  Terminal,
} from "lucide-react";

function getOrCreateSessionCustomerId(): string {
  const KEY = "razorai_customer_session_v2";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "cust_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch (e) {
    return "cust_" + Date.now().toString(36);
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "buyer" | "products" | "audit" | "api">("dashboard");
  const [customerId] = useState<string>(() => getOrCreateSessionCustomerId());

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Logo & Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => setActiveTab("dashboard")}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--accent-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)",
              }}
            >
              <Zap size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                RazorAI
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>
                Agentic Commerce Gateway
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "chat", label: "AI Sales", icon: Sparkles },
              { id: "buyer", label: "AI Buyer", icon: Bot },
              { id: "products", label: "Products", icon: Package },
              { id: "audit", label: "Audit Trail", icon: ShieldCheck },
              { id: "api", label: "API Protocol", icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: isActive ? "var(--bg-accent)" : "transparent",
                    color: isActive ? "#818cf8" : "var(--text-secondary)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={16} color={isActive ? "#818cf8" : "var(--text-secondary)"} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Merchant Status Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--bg-card)",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "12px",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)" }} />
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Demo Store</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="container" style={{ flex: 1, paddingTop: "24px" }}>
        {activeTab === "dashboard" && <Dashboard onNavigate={(tab) => setActiveTab(tab as any)} />}
        {activeTab === "chat" && <AISales customerId={customerId} />}
        {activeTab === "buyer" && <AIBuyer customerId={customerId} />}
        {activeTab === "products" && <Products customerId={customerId} />}
        {activeTab === "audit" && <AuditTrail />}
        {activeTab === "api" && <APIProtocol />}
      </main>
    </div>
  );
}
