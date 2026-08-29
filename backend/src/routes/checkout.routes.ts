import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { validateOrderPolicy } from "../lib/policy-engine";
import { createPaymentRequest } from "../services/payment.service";

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

export default router;
