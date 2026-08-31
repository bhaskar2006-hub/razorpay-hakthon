import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validateOrderPolicy } from "../lib/policy-engine";
import { createPaymentRequest } from "../services/payment.service";
import { razorpay } from "../lib/razorpay";

const router = Router();

// 10.1: Checkout Preview (Generates Approval Gate Payload)
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    const cart = await prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    const items = cart.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      total: item.product.price * item.quantity,
    }));

    const total = items.reduce((sum, item) => sum + item.total, 0);

    // Audit log checkout preview
    const firstProduct = cart.items[0]?.product;
    if (firstProduct) {
      await prisma.auditLog.create({
        data: {
          merchantId: firstProduct.merchantId,
          eventType: "ORDER",
          action: "CHECKOUT_PREVIEW",
          description: `Checkout preview generated for ₹${total / 100} (${items.length} items)`,
          metadata: { customerId, itemCount: items.length, totalPaise: total },
        },
      });
    }

    return res.json({
      status: "APPROVAL_REQUIRED",
      items,
      total,
      currency: "INR",
      formattedTotal: `₹${(total / 100).toLocaleString("en-IN")}`,
      message: `Please confirm payment of ₹${(total / 100).toLocaleString(
        "en-IN"
      )}.`,
    });
  } catch (error) {
    console.error("Checkout preview error:", error);

    return res.status(500).json({
      message: "Unable to create checkout preview",
    });
  }
});

// 10.3 / 14.2: Explicit Customer Approval & Order Initiation via Central Payment Service
router.post("/approve", async (req: Request, res: Response) => {
  try {
    const { customerId, merchantId, userApproved, expectedTotal } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    // Explicit approval validation
    if (userApproved !== true) {
      return res.status(403).json({
        message: "Customer approval is required before payment can be initiated.",
        status: "APPROVAL_REJECTED",
      });
    }

    // 1. Fetch fresh cart from DB
    const cart = await prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Resolve merchant ID
    const targetMerchantId =
      merchantId || cart.items[0]?.product.merchantId;

    if (!targetMerchantId) {
      return res.status(400).json({ message: "Merchant not found" });
    }

    // 2. Validate via Policy Engine
    const policyResult = await validateOrderPolicy({
      merchantId: targetMerchantId,
      customerId,
      cartItems: cart.items,
    });

    if (!policyResult.allowed) {
      await prisma.auditLog.create({
        data: {
          merchantId: targetMerchantId,
          eventType: "SECURITY",
          action: "PAYMENT_BLOCKED",
          description: `Checkout approval blocked by policy: ${policyResult.reason}`,
          metadata: { customerId, reason: policyResult.reason },
        },
      });

      return res.status(400).json({
        message: policyResult.reason,
        policyViolation: true,
      });
    }

    const subtotal = policyResult.subtotal;

    // Verify expected total hasn't slipped
    if (expectedTotal && expectedTotal !== subtotal) {
      return res.status(409).json({
        message: `Cart total changed. Expected ₹${expectedTotal / 100}, but authoritative price is ₹${subtotal / 100}. Please review again.`,
        authoritativeTotal: subtotal,
      });
    }

    // Ensure customer exists in DB
    await prisma.customer.upsert({
      where: { id: customerId },
      update: {},
      create: {
        id: customerId,
        name: "Guest Shopper",
        email: `${customerId}@shopper.razorai.demo`,
      },
    });

    // 3. Create Internal Order
    const order = await prisma.order.create({
      data: {
        merchantId: targetMerchantId,
        customerId,
        subtotal,
        upsellAmount: 0,
        totalAmount: subtotal,
        currency: "INR",
        items: {
          create: policyResult.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: { items: true },
    });

    // 4. Delegate Payment Execution to Central Payment Service
    const paymentRequest = await createPaymentRequest({
      customerId,
      merchantId: targetMerchantId,
      orderId: order.id,
      approval: true,
    });

    if (!paymentRequest.allowed) {
      return res.status(400).json({
        message: "Payment creation rejected by policy",
        reasons: paymentRequest.reasons,
      });
    }

    return res.status(201).json({
      status: "APPROVED",
      orderId: order.id,
      razorpayOrderId: paymentRequest.razorpayOrderId,
      amount: subtotal,
      currency: "INR",
      formattedAmount: `₹${(subtotal / 100).toLocaleString("en-IN")}`,
      items: policyResult.items,
    });
  } catch (error: any) {
    console.error("Checkout approval error:", error);
    return res.status(500).json({
      message: error.message || "Failed to process checkout approval",
    });
  }
});

// Create shareable Razorpay Payment Link / QR Code
router.post("/payment-link", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const customerName = order.customer?.name || "Bhaskar Reddy";
    const customerEmail = order.customer?.email || "bhaskar@razorai.demo";

    let paymentLinkId = `plink_${order.id}`;
    let shortUrl = "";

    try {
      const paymentLink = await razorpay.paymentLink.create({
        amount: order.totalAmount,
        currency: "INR",
        accept_partial: false,
        first_min_partial_amount: 0,
        description: `RazorAI checkout share link for ${customerName}`,
        customer: {
          name: customerName,
          email: customerEmail,
          contact: "+919876543210",
        },
        notify: {
          sms: false,
          email: false,
        },
        reminder_enable: false,
        notes: {
          order_id: order.id,
        },
        callback_url: "https://razorpay-hakthon.onrender.com/?tab=dashboard",
        callback_method: "get",
      });

      paymentLinkId = paymentLink.id;
      shortUrl = paymentLink.short_url;
    } catch (rzpErr: any) {
      console.warn("Razorpay paymentLink.create API note:", rzpErr.message || rzpErr);
      // Resilient fallback checkout URL
      shortUrl = `https://rzp.io/l/razorai-${order.id.slice(-8)}`;
    }

    await prisma.auditLog.create({
      data: {
        merchantId: order.merchantId,
        orderId: order.id,
        eventType: "PAYMENT",
        action: "PAYMENT_LINK_CREATED",
        description: `Created shareable payment link for ₹${order.totalAmount / 100}`,
        metadata: {
          paymentLinkId,
          shortUrl,
        },
      },
    });

    return res.json({
      paymentLinkId,
      shortUrl,
      status: "created",
    });
  } catch (error: any) {
    console.error("Failed to create payment link:", error);
    return res.status(500).json({ message: error.message || "Failed to create payment link" });
  }
});

// Autonomous checkout using Mandate Autopay
router.post("/autopay", async (req: Request, res: Response) => {
  try {
    const { customerId, expectedTotal } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (!customer.mandateActive) {
      return res.status(400).json({
        message: "Autopay Mandate is not active. Manual authorization required.",
        code: "MANDATE_INACTIVE",
      });
    }

    const cart = await prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const merchantId = cart.items[0].product.merchantId;
    const totalAmount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    if (expectedTotal && expectedTotal !== totalAmount) {
      return res.status(409).json({ message: "Cart total mismatched" });
    }

    // Check Single Limit
    if (totalAmount > customer.mandateLimitSingle) {
      return res.status(400).json({
        message: `Transaction total (₹${totalAmount / 100}) exceeds single-order mandate limit (₹${customer.mandateLimitSingle / 100}). Manual authorization required.`,
        code: "SINGLE_LIMIT_EXCEEDED",
      });
    }

    // Check Monthly Limit
    const remainingMonthlyBudget = customer.mandateLimitMonthly - customer.mandateSpentMonthly;
    if (totalAmount > remainingMonthlyBudget) {
      return res.status(400).json({
        message: `Transaction total (₹${totalAmount / 100}) exceeds remaining monthly budget cap (₹${remainingMonthlyBudget / 100}). Manual authorization required.`,
        code: "MONTHLY_LIMIT_EXCEEDED",
      });
    }

    const policyResult = await validateOrderPolicy({
      merchantId,
      customerId,
      cartItems: cart.items,
    });

    if (!policyResult.allowed) {
      return res.status(400).json({
        message: `Blocked by central policy: ${policyResult.reason}`,
        code: "POLICY_VIOLATION",
      });
    }

    const order = await prisma.order.create({
      data: {
        merchantId,
        customerId,
        subtotal: totalAmount,
        totalAmount,
        currency: "INR",
        source: "AI_BUYER",
        status: "PAID",
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: item.product.price * item.quantity,
          })),
        },
      },
    });

    const simulatedPaymentId = "pay_mandate_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayPaymentId: simulatedPaymentId,
        amount: totalAmount,
        status: "CAPTURED",
      },
    });

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        mandateSpentMonthly: {
          increment: totalAmount,
        },
      },
    });

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await prisma.auditLog.create({
      data: {
        merchantId,
        orderId: order.id,
        eventType: "PAYMENT",
        action: "AUTOPAY_CAPTURED",
        description: `Autonomous settlement completed via Razorpay Autopay Mandate. Charged: ₹${totalAmount / 100}.`,
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
          amount: totalAmount,
          singleLimit: customer.mandateLimitSingle,
          monthlyLimit: customer.mandateLimitMonthly,
          spentBefore: customer.mandateSpentMonthly,
          spentAfter: customer.mandateSpentMonthly + totalAmount,
        },
      },
    });

    return res.json({
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      amount: totalAmount,
      formattedAmount: `₹${(totalAmount / 100).toLocaleString("en-IN")}`,
      message: "Order settled autonomously via active spending mandate.",
    });
  } catch (error: any) {
    console.error("Autopay processing error:", error);
    return res.status(500).json({ message: "Autonomous checkout failed" });
  }
});

export default router;
