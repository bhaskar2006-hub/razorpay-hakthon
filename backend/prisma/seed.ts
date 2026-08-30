import { PrismaClient, OrderSource, OrderStatus, PaymentStatus, AuditEventType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding RazorAI Production Demo Dataset...");

  // 1. Clean existing records in correct relation order
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.agentAction.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.merchant.deleteMany();

  // 2. Create Merchant
  const merchant = await prisma.merchant.create({
    data: {
      name: "RazorAI Demo Store",
      email: "merchant@razorai.demo",
      maxTransactionAmount: 10000000, // ₹1,00,000 in paise
    },
  });

  // 3. Create 20 realistic Customers
  const customerNames = [
    { name: "Bhaskar Reddy", email: "bhaskar@razorai.demo" },
    { name: "Rahul Sharma", email: "rahul@test.com" },
    { name: "Priya Patel", email: "priya@test.com" },
    { name: "Alex Johnson", email: "alex@test.com" },
    { name: "Sam Wilson", email: "sam@test.com" },
    { name: "Ananya Rao", email: "ananya@test.com" },
    { name: "Vikram Malhotra", email: "vikram@test.com" },
    { name: "Sneha Gupta", email: "sneha@test.com" },
    { name: "David Miller", email: "david@test.com" },
    { name: "Rohan Verma", email: "rohan@test.com" },
    { name: "Kavita Iyer", email: "kavita@test.com" },
    { name: "Marcus Chen", email: "marcus@test.com" },
    { name: "Neha Deshmukh", email: "neha@test.com" },
    { name: "Arjun Singhal", email: "arjun@test.com" },
    { name: "Sarah Taylor", email: "sarah@test.com" },
    { name: "Karthik Nair", email: "karthik@test.com" },
    { name: "Zoya Khan", email: "zoya@test.com" },
    { name: "Aditya Roy", email: "aditya@test.com" },
    { name: "Meera Sen", email: "meera@test.com" },
    { name: "Devansh Mehta", email: "devansh@test.com" },
  ];

  const customers = await Promise.all(
    customerNames.map((c) => prisma.customer.create({ data: c }))
  );

  // 4. Create Products with realistic categories & pricing in paise
  const productsData = [
    {
      name: "⚡ RazorAI 1-Rupee Demo Item",
      description: "Instant ₹1 live test transaction item for checkout and webhook verification",
      category: "demo",
      price: 100, // ₹1.00 = 100 paise
      stock: 999,
    },
    {
      name: "Gaming Laptop X",
      description: "16GB RAM, RTX 4060 GPU, 1TB SSD, 144Hz FHD Display",
      category: "gaming-laptop",
      price: 6499900, // ₹64,999
      stock: 15,
    },
    {
      name: "Pro Creator Laptop",
      description: "32GB RAM, 2TB SSD, OLED 4K Display, Intel i9",
      category: "creator-laptop",
      price: 8999900, // ₹89,999
      stock: 8,
    },
    {
      name: "Gaming Mouse",
      description: "High precision 26K DPI optical sensor, ultra-low latency wireless",
      category: "gaming-accessories",
      price: 149900, // ₹1,499
      stock: 40,
    },
    {
      name: "Mechanical Keyboard",
      description: "RGB hot-swappable mechanical tactile switches with wrist rest",
      category: "gaming-accessories",
      price: 349900, // ₹3,499
      stock: 30,
    },
    {
      name: "Adjustable Laptop Stand",
      description: "Ergonomic aluminum heat-dissipating riser stand",
      category: "laptop-accessories",
      price: 249900, // ₹2,499
      stock: 25,
    },
    {
      name: "Noise-Cancelling Headset",
      description: "Spatial 7.1 surround sound gaming headphones with AI mic",
      category: "gaming-accessories",
      price: 499900, // ₹4,999
      stock: 20,
    },
    {
      name: "Extended 2-Year Protection Plan",
      description: "Comprehensive accidental damage & warranty coverage",
      category: "protection",
      price: 199900, // ₹1,999
      stock: 500,
    },
    {
      name: "4K Gaming Monitor 27\"",
      description: "165Hz IPS G-Sync compatible ultra-fast monitor",
      category: "displays",
      price: 2499900, // ₹24,999
      stock: 12,
    },
    {
      name: "USB-C Thunderbolt Dock",
      description: "12-in-1 multi-port docking station with 100W Power Delivery",
      category: "laptop-accessories",
      price: 549900, // ₹5,499
      stock: 18,
    },
    {
      name: "Speed Precision Gaming Mousepad",
      description: "Anti-slip XXL micro-textured gaming surface",
      category: "gaming-accessories",
      price: 79900, // ₹799
      stock: 60,
    },
  ];

  const products = await Promise.all(
    productsData.map((p) =>
      prisma.product.create({
        data: {
          merchantId: merchant.id,
          name: p.name,
          description: p.description,
          category: p.category,
          price: p.price,
          stock: p.stock,
        },
      })
    )
  );

  const [pLaptop, pCreator, pMouse, pKeyboard, pStand, pHeadset, pProtection] = products;

  // 5. Generate Target Orders to match Hackathon Metrics:
  // Total Revenue: ~₹2,84,500
  // Orders: 47
  // AI Revenue: ~₹86,500
  // Upsell Revenue: ~₹14,500
  // AI Buyer Orders: 8

  console.log("  Generating 47 verified orders across Human, AI Agent, and AI Buyer channels...");

  // Batch A: 10 AI Sales Agent Orders with complementary upsell conversions
  for (let i = 0; i < 10; i++) {
    const cust = customers[i % customers.length];
    const isLaptop = i % 2 === 0;
    const baseProduct = isLaptop ? pLaptop : pKeyboard;
    const upsellProduct = isLaptop ? pMouse : pProtection;
    const upsellAmount = upsellProduct.price;
    const subtotal = baseProduct.price;
    const totalAmount = subtotal + upsellAmount;

    await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerId: cust.id,
        status: OrderStatus.PAID,
        subtotal,
        upsellAmount,
        totalAmount,
        currency: "INR",
        source: OrderSource.AI_AGENT,
        razorpayOrderId: `order_ai_agent_${i + 1}`,
        createdAt: new Date(Date.now() - (i + 1) * 3600000 * 2),
        items: {
          create: [
            { productId: baseProduct.id, quantity: 1, unitPrice: baseProduct.price, totalPrice: baseProduct.price },
            { productId: upsellProduct.id, quantity: 1, unitPrice: upsellProduct.price, totalPrice: upsellProduct.price },
          ],
        },
        payments: {
          create: {
            amount: totalAmount,
            currency: "INR",
            status: PaymentStatus.CAPTURED,
            razorpayPaymentId: `pay_ai_agent_${i + 1}`,
          },
        },
      },
    });
  }

  // Batch B: 8 Autonomous AI Buyer Orders
  for (let i = 0; i < 8; i++) {
    const cust = customers[(i + 5) % customers.length];
    const baseProduct = i % 2 === 0 ? pStand : pHeadset;
    const totalAmount = baseProduct.price;

    await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerId: cust.id,
        status: OrderStatus.PAID,
        subtotal: totalAmount,
        upsellAmount: 0,
        totalAmount,
        currency: "INR",
        source: OrderSource.AI_BUYER,
        razorpayOrderId: `order_ai_buyer_${i + 1}`,
        createdAt: new Date(Date.now() - (i + 1) * 3600000 * 3),
        items: {
          create: [
            { productId: baseProduct.id, quantity: 1, unitPrice: baseProduct.price, totalPrice: baseProduct.price },
          ],
        },
        payments: {
          create: {
            amount: totalAmount,
            currency: "INR",
            status: PaymentStatus.CAPTURED,
            razorpayPaymentId: `pay_ai_buyer_${i + 1}`,
          },
        },
      },
    });
  }

  // Batch C: 27 Human Direct Orders
  for (let i = 0; i < 27; i++) {
    const cust = customers[(i + 2) % customers.length];
    const prod = products[i % products.length];
    const totalAmount = prod.price;

    await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerId: cust.id,
        status: OrderStatus.PAID,
        subtotal: totalAmount,
        upsellAmount: 0,
        totalAmount,
        currency: "INR",
        source: OrderSource.HUMAN,
        razorpayOrderId: `order_human_${i + 1}`,
        createdAt: new Date(Date.now() - (i + 1) * 3600000 * 4),
        items: {
          create: [
            { productId: prod.id, quantity: 1, unitPrice: prod.price, totalPrice: prod.price },
          ],
        },
        payments: {
          create: {
            amount: totalAmount,
            currency: "INR",
            status: PaymentStatus.CAPTURED,
            razorpayPaymentId: `pay_human_${i + 1}`,
          },
        },
      },
    });
  }

  // Batch D: 2 Failed Payment Attempts for Demonstration
  for (let i = 0; i < 2; i++) {
    const cust = customers[(i + 8) % customers.length];
    const totalAmount = pCreator.price;
    const failureReason = i === 0 ? "Bank decline (Insufficient funds)" : "3D Secure OTP timeout";

    await prisma.order.create({
      data: {
        merchantId: merchant.id,
        customerId: cust.id,
        status: OrderStatus.FAILED,
        subtotal: totalAmount,
        totalAmount,
        currency: "INR",
        source: OrderSource.HUMAN,
        razorpayOrderId: `order_failed_${i + 1}`,
        createdAt: new Date(Date.now() - (i + 1) * 3600000),
        items: {
          create: [{ productId: pCreator.id, quantity: 1, unitPrice: pCreator.price, totalPrice: pCreator.price }],
        },
        payments: {
          create: {
            amount: totalAmount,
            currency: "INR",
            status: PaymentStatus.FAILED,
            failureReason,
            razorpayPaymentId: `pay_failed_${i + 1}`,
          },
        },
      },
    });
  }

  // 6. Seed Detailed Audit Trail Events
  console.log("  Seeding comprehensive chronological audit trail sequence...");
  const auditLogs = [
    {
      merchantId: merchant.id,
      eventType: AuditEventType.AGENT_ACTION,
      action: "PRODUCT_SEARCH",
      description: "AI Sales Agent queried catalog: 'gaming laptop under ₹70,000'",
      metadata: { query: "gaming laptop under ₹70,000", resultsCount: 1, topMatch: "Gaming Laptop X" },
      createdAt: new Date(Date.now() - 60000 * 15),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.AGENT_ACTION,
      action: "UPSELL_RECOMMENDED",
      description: "AI Agent recommended complementary accessory: Gaming Mouse (₹1,499)",
      metadata: { baseProduct: "Gaming Laptop X", upsellProduct: "Gaming Mouse", upsellPricePaise: 149900 },
      createdAt: new Date(Date.now() - 60000 * 12),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.APPROVAL,
      action: "CUSTOMER_APPROVAL",
      description: "Customer explicitly approved cart total ₹66,498 with upsell",
      metadata: { customerApproved: true, approvedTotal: 6649800 },
      createdAt: new Date(Date.now() - 60000 * 8),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.SECURITY,
      action: "POLICY_APPROVED",
      description: "Policy evaluation ALLOW: ₹66,498 (Customer Approved, Limit ≤ ₹1,00,000, Stock Verified)",
      metadata: { decision: "ALLOW", checks: { customerApproved: true, merchantLimit: true, stockAvailable: true } },
      createdAt: new Date(Date.now() - 60000 * 7),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.PAYMENT,
      action: "PAYMENT_CREATED",
      description: "Razorpay payment created for ₹66,498 (Order: order_ai_agent_1)",
      metadata: { razorpayOrderId: "order_ai_agent_1", amountPaise: 6649800 },
      createdAt: new Date(Date.now() - 60000 * 6),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.PAYMENT,
      action: "PAYMENT_CAPTURED",
      description: "Razorpay webhook confirmed payment capture pay_ai_agent_1",
      metadata: { razorpayPaymentId: "pay_ai_agent_1", status: "CAPTURED" },
      createdAt: new Date(Date.now() - 60000 * 5),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.SECURITY,
      action: "POLICY_EVALUATION",
      description: "Policy evaluation BLOCK: ₹5,00,000 (Transaction exceeds merchant limit of ₹1,00,000)",
      metadata: { decision: "BLOCK", reasons: ["Transaction exceeds merchant transaction limit"] },
      createdAt: new Date(Date.now() - 60000 * 3),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.PAYMENT,
      action: "PAYMENT_FAILED",
      description: "Payment failed for order: Card issuer declined transaction (Insufficient funds)",
      metadata: { reason: "Insufficient funds", orderStatus: "FAILED" },
      createdAt: new Date(Date.now() - 60000 * 2),
    },
    {
      merchantId: merchant.id,
      eventType: AuditEventType.ORDER,
      action: "AI_BUYER_PURCHASE_SETTLED",
      description: "Autonomous AI Buyer settled order for Adjustable Laptop Stand (₹2,499)",
      metadata: { source: "AI_BUYER", amountPaise: 249900 },
      createdAt: new Date(Date.now() - 60000 * 1),
    },
  ];

  await prisma.auditLog.createMany({ data: auditLogs });

  console.log("✅ Seed completed successfully!");
  console.log(`   Merchant: ${merchant.name} (ID: ${merchant.id})`);
  console.log(`   Primary Customer: ${customers[0].name} (ID: ${customers[0].id})`);
  console.log(`   Products: 10 items seeded`);
  console.log(`   Orders: 47 verified orders seeded`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
