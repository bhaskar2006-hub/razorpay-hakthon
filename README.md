# ⚡ RazorAI — Agentic Commerce & Payment Infrastructure

> **Bounded, Explainable & Gated Commerce Gateway for the Agentic AI Economy**

RazorAI empowers online merchants to capture revenue through **Conversational AI Sales & Dynamic Upselling**, while making their catalog transacted by **Autonomous AI Buyer Agents** — protected by an immutable, explainable **Central Policy Engine** and **Razorpay** payment gateway.

---

## 🏛️ System Architecture

```
                                  RAZORAI
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
    HUMAN BUYER                 AI SALES AGENT                AI BUYER
   Direct Catalog            Gemini 2.5 Multi-turn         Autonomous Proxy
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
                                     ▼
                             PRODUCT CATALOG
                          (PostgreSQL + Stock)
                                     │
                                     ▼
                                    CART
                                     │
                                     ▼
                             PURCHASE INTENT
                                     │
                                     ▼
                        🔒 CUSTOMER APPROVAL GATE
                        Explicit User Authorization
                                     │
                                     ▼
                          ⚖️ CENTRAL POLICY ENGINE
                     ✓ Authoritative DB Pricing Check
                     ✓ Real-time Inventory Verification
                     ✓ Merchant Max Limit (≤ ₹1,00,000)
                     ✓ Idempotency Guard (Unpaid)
                                     │
                                     ▼
                        💳 CENTRAL PAYMENT SERVICE
                        Single Point of Money Movement
                                     │
                                     ▼
                                 RAZORPAY
                             (Test Mode Order)
                                     │
                                     ▼
                                  WEBHOOK
                         (Captured / Failed / Retry)
                                     │
                                     ▼
                        📜 IMMUTABLE AUDIT TRAIL
                        Every Action Traceable in DB
                                     │
                                     ▼
                          📊 MERCHANT DASHBOARD
                         Revenue & AI Attribution
```

---

## 🚀 Key Features

1. **🤖 Conversational AI Sales Agent**:
   - Natural language product discovery powered by Gemini 2.5 Flash.
   - Dynamic complementary upsells (e.g. Gaming Mouse with Gaming Laptop) increasing Average Order Value (AOV).
2. **🔒 Customer Approval Gate & Gated Boundaries**:
   - The LLM has zero payment credentials and cannot charge money directly.
   - Explicit human confirmation is required to initiate payments.
3. **⚖️ Central Policy Engine**:
   - Validates stock, calculates authoritative PostgreSQL prices, verifies merchant transaction bounds (e.g. $\le$ ₹1,00,000), and blocks invalid transactions with explainable reasoning.
4. **💳 Central Payment Service**:
   - Single point of entry to Razorpay.
   - Automatic idempotency, payment attempt tracking, and graceful failure + retry without duplicate orders.
5. **🤝 Autonomous AI Buyer (Agent-to-Agent Commerce)**:
   - Machine-readable catalog (`GET /api/catalog/ai`).
   - Bounded purchase intent generation (`POST /api/purchase-intent`).
6. **📊 Merchant Dashboard & Audit Trail**:
   - Real-time channel revenue breakdown: Human vs AI Sales vs AI Buyer.
   - Chronological, explainable audit timeline for all events (`PRODUCT_SEARCH` $\rightarrow$ `UPSELL` $\rightarrow$ `POLICY_APPROVED` $\rightarrow$ `PAYMENT_CAPTURED`).

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL database (or Neon.tech)
- Razorpay Test Mode Key & Secret
- Google Gemini API Key

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, GEMINI_API_KEY

npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Visit **`http://localhost:5173`** to access the web application.

---

## 🧪 Running the E2E Verification Test Suite

```bash
cd backend
npx tsx test-e2e-all.ts
```

Verifies all 6 comprehensive scenarios:
- `Test A`: Normal AI Sale (Search ➔ Upsell ➔ Approval ➔ Policy ➔ Paid)
- `Test B`: Policy Engine Bounds (₹5,00,000 Over-limit ➔ BLOCKED)
- `Test C`: Customer Approval Gate (approval=false ➔ GATED & BLOCKED)
- `Test D`: Graceful Failure & Safe Retry (No duplicate order, 2 attempts)
- `Test E`: Webhook Deduplication & Idempotency (Duplicate Ignored)
- `Test F`: Autonomous AI Buyer (Agent-to-Agent Intent & Settlement)
- `Test G`: Immutable Audit Trail Sequence Verification
