import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { razorpay } from "../lib/razorpay";
import { validateOrderPolicy } from "../lib/policy-engine";
import { createPaymentRequest } from "../services/payment.service";

const router = Router();

// CREATE Order from Cart with Policy Engine checks & Razorpay integration
router.post("/", async (req: Request, res: Response) => {
  try {
    const { customerId, merchantId } = req.body;

    if (!customerId || !merchantId) {
      return res.status(400).json({
        message: "customerId and merchantId are required",
      });
    }

    // 1. Get cart
    const cart = await prisma.cart.findUnique({
      where: { customerId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    // 2. Validate against Policy Engine
    const policyResult = await validateOrderPolicy({
      merchantId,
      customerId,
      cartItems: cart.items,
    });

    if (!policyResult.allowed) {
      // Log policy violation to Audit Log
      await prisma.auditLog.create({
        data: {
          merchantId,
          eventType: "SECURITY",
          action: "POLICY_VIOLATION",
          description: `Order creation rejected: ${policyResult.reason}`,
          metadata: { customerId, reason: policyResult.reason },
        },
      });

      return res.status(400).json({
        message: policyResult.reason,
        policyViolation: true,
      });
    }

    const subtotal = policyResult.subtotal;

    // 3. Create internal order
    const order = await prisma.order.create({
      data: {
        merchantId,
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
      include: {
        items: true,
      },
    });

    // 4. Create Payment through Central Payment Service (with policy evaluation)
    const paymentRequest = await createPaymentRequest({
      customerId,
      merchantId,
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
      orderId: order.id,
      razorpayOrderId: paymentRequest.razorpayOrderId,
      amount: subtotal,
      formattedAmount: `₹${(subtotal / 100).toLocaleString("en-IN")}`,
      currency: "INR",
      items: policyResult.items,
    });
  } catch (error: any) {
    console.error("Order creation error:", error);

    return res.status(500).json({
      message: error.message || "Failed to create order",
    });
  }
});

// GET order by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch order" });
  }
});

// GET orders for a customer
router.get("/customer/:customerId", async (req: Request, res: Response) => {
  try {
    const customerId = String(req.params.customerId);
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch customer orders" });
  }
});

// RETRY Payment for an existing failed or pending order (No duplicate order)
router.post("/:id/retry", async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "PAID") {
      return res.status(400).json({ message: "Order is already paid" });
    }

    // Generate a fresh Razorpay order for this exact same order
    const razorpayOrder = await razorpay.orders.create({
      amount: order.totalAmount,
      currency: order.currency || "INR",
      receipt: `retry_${order.id}_${Date.now()}`,
    });

    // Create a new Payment attempt record under this order and update order status
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PENDING",
          razorpayOrderId: razorpayOrder.id,
        },
      }),

      prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          currency: order.currency || "INR",
          status: "CREATED",
        },
      }),

      prisma.auditLog.create({
        data: {
          merchantId: order.merchantId,
          orderId: order.id,
          eventType: "ORDER",
          action: "PAYMENT_RETRY_INITIATED",
          description: `Payment retry initiated for order ${order.id}`,
          metadata: {
            newRazorpayOrderId: razorpayOrder.id,
            amount: order.totalAmount,
          },
        },
      }),
    ]);

    return res.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: order.totalAmount,
      formattedAmount: `₹${(order.totalAmount / 100).toLocaleString("en-IN")}`,
      currency: order.currency || "INR",
      message: "Retry payment session created",
    });
  } catch (error: any) {
    console.error("Order retry error:", error);
    return res.status(500).json({ message: error.message || "Failed to retry order" });
  }
});

export default router;
