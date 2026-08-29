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
app.use("/api/webhooks", webhookRoutes);
app.use("/api/agent", agentRoutes);
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
