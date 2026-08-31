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
import affordabilityRoutes from "./routes/affordability.routes";
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
app.use("/api/checkout/affordability", affordabilityRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/purchase-intent", purchaseIntentRoutes);
app.use("/api/policy", policyRoutes);
app.use("/api/dashboard", dashboardRoutes);

import { prisma } from "./lib/prisma";

async function bootstrapDatabase() {
  try {
    // 1. Ensure PostgreSQL columns & WebhookLog table exist (safe for postgres and sqlite)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mandateActive" BOOLEAN NOT NULL DEFAULT false;
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mandateLimitMonthly" INTEGER NOT NULL DEFAULT 2000000;
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mandateLimitSingle" INTEGER NOT NULL DEFAULT 500000;
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "mandateSpentMonthly" INTEGER NOT NULL DEFAULT 0;
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "razorpayMandateToken" TEXT;
    `).catch(() => {});
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WebhookLog" (
        "id" TEXT NOT NULL,
        "event" TEXT NOT NULL,
        "payload" JSONB NOT NULL,
        "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
      );
    `).catch(() => {});

    // 2. Ensure Merchant and Products exist
    let merchant = await prisma.merchant.findFirst();
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          name: "RazorAI Demo Store",
          email: "merchant@razorai.demo",
          maxTransactionAmount: 10000000,
        },
      });
    }

    const productCount = await prisma.product.count();
    if (productCount === 0) {
      console.log("Seeding base products for store catalog...");
      const productsData = [
        {
          name: "⚡ RazorAI 1-Rupee Demo Item",
          description: "Instant ₹1 live test transaction item for checkout and webhook verification",
          category: "demo",
          price: 100,
          stock: 999,
        },
        {
          name: "Gaming Laptop X",
          description: "16GB RAM, RTX 4060 GPU, 1TB SSD, 144Hz FHD Display",
          category: "gaming-laptop",
          price: 6499900,
          stock: 15,
        },
        {
          name: "Pro Creator Laptop",
          description: "32GB RAM, 2TB SSD, OLED 4K Display, Intel i9",
          category: "creator-laptop",
          price: 8999900,
          stock: 8,
        },
        {
          name: "Gaming Mouse",
          description: "High precision 26K DPI optical sensor, ultra-low latency wireless",
          category: "gaming-accessories",
          price: 149900,
          stock: 40,
        },
        {
          name: "Mechanical Keyboard",
          description: "RGB hot-swappable mechanical tactile switches with wrist rest",
          category: "gaming-accessories",
          price: 349900,
          stock: 30,
        },
        {
          name: "Adjustable Laptop Stand",
          description: "Ergonomic aluminum heat-dissipating riser stand",
          category: "laptop-accessories",
          price: 249900,
          stock: 25,
        },
        {
          name: "Noise-Cancelling Headset",
          description: "Spatial 7.1 surround sound gaming headphones with AI mic",
          category: "gaming-accessories",
          price: 499900,
          stock: 20,
        },
        {
          name: "Extended 2-Year Protection Plan",
          description: "Comprehensive accidental damage & warranty coverage",
          category: "protection",
          price: 199900,
          stock: 500,
        },
        {
          name: "4K Gaming Monitor 27\"",
          description: "165Hz IPS G-Sync compatible ultra-fast monitor",
          category: "displays",
          price: 2499900,
          stock: 12,
        },
        {
          name: "USB-C Thunderbolt Dock",
          description: "12-in-1 multi-port docking station with 100W Power Delivery",
          category: "laptop-accessories",
          price: 549900,
          stock: 18,
        },
        {
          name: "Speed Precision Gaming Mousepad",
          description: "Anti-slip XXL micro-textured gaming surface",
          category: "gaming-accessories",
          price: 79900,
          stock: 60,
        },
      ];

      for (const p of productsData) {
        await prisma.product.create({
          data: {
            merchantId: merchant.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            stock: p.stock,
          },
        });
      }
    }
  } catch (err) {
    console.warn("Bootstrap DB warning:", err);
  }
}

const PORT = process.env.PORT || 5000;

bootstrapDatabase().finally(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
