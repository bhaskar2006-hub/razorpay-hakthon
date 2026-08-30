import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import productRoutes from "./routes/product.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes";
import paymentRoutes from "./routes/payment.routes";
import webhookRoutes from "./routes/webhook.routes";
import agentRoutes from "./routes/agent.routes";
import buyerRoutes from "./routes/buyer.routes";
import checkoutRoutes from "./routes/checkout.routes";
import auditRoutes from "./routes/audit.routes";
import catalogRoutes from "./routes/catalog.routes";
import purchaseIntentRoutes from "./routes/purchase-intent.routes";
import policyRoutes from "./routes/policy.routes";
import dashboardRoutes from "./routes/dashboard.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// AI Commerce Discovery Protocol (Track 01 Headless AI Protocol)
app.get("/.well-known/ai-commerce.json", (_req, res) => {
  res.json({
    name: "RazorAI Agentic Commerce Gateway",
    version: "1.0.0",
    description: "Machine-readable e-commerce protocol for autonomous AI buyer agents and conversational commerce",
    protocol_version: "1.0-agentic",
    endpoints: {
      discovery: "/.well-known/ai-commerce.json",
      catalog: "/api/catalog/ai",
      intent: "/api/purchase-intent",
      checkout_preview: "/api/checkout/preview",
      checkout_approve: "/api/checkout/approve",
      payments_verify: "/api/payments/verify",
      webhooks: "/api/webhooks",
      audit_logs: "/api/audit",
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
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "RazorAI Backend",
  });
});

// Routes
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/webhooks/razorpay", webhookRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/buyer/intent", purchaseIntentRoutes);
app.use("/api/buyer", buyerRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/purchase-intent", purchaseIntentRoutes);
app.use("/api/policy", policyRoutes);
app.use("/api/dashboard", dashboardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
