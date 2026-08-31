import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyPaymentSignature } from "../lib/payment-verification";
import { createPaymentRequest } from "../services/payment.service";

const router = Router();

// CREATE Razorpay Order (Server-Side Bounded & Gated)
router.post(["/create", "/create-order"], async (req: Request, res: Response) => {
  try {
    const { orderId, customerId, merchantId, approval = true } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { merchant: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const result = await createPaymentRequest({
      customerId: customerId || order.customerId || "",
      merchantId: merchantId || order.merchantId,
      orderId: order.id,
      approval: Boolean(approval),
    });

    if (!result.allowed) {
      return res.status(400).json({
        message: "Payment creation rejected by policy engine",
        reasons: result.reasons,
      });
    }

    return res.json({
      razorpay_order_id: result.razorpayOrderId,
      amount: order.totalAmount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("Payment create order error:", error);
    return res.status(500).json({ message: "Failed to create payment order" });
  }
});

// VERIFY Payment Signature (Success)
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Missing payment information",
      });
    }

    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid payment signature",
      });
    }

    const order = await prisma.order.findUnique({
      where: {
        razorpayOrderId: razorpay_order_id,
      },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Idempotency protection
    if (order.status === "PAID") {
      return res.json({
        message: "Order already processed",
        orderId: order.id,
      });
    }

    const latestPayment = order.payments[0];

    await prisma.$transaction([
      ...(latestPayment
        ? [
            prisma.payment.update({
              where: { id: latestPayment.id },
              data: {
                razorpayPaymentId: razorpay_payment_id,
                status: "CAPTURED",
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                orderId: order.id,
                razorpayPaymentId: razorpay_payment_id,
                amount: order.totalAmount,
                status: "CAPTURED",
              },
            }),
          ]),

      prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      }),

      // Clear customer's cart upon successful payment
      ...(order.customerId
        ? [
            prisma.cartItem.deleteMany({
              where: {
                cart: { customerId: order.customerId },
              },
            }),
          ]
        : []),

      prisma.auditLog.create({
        data: {
          merchantId: order.merchantId,
          orderId: order.id,
          eventType: "PAYMENT",
          action: "PAYMENT_VERIFIED",
          description: `Payment ₹${order.totalAmount / 100} verified successfully via Razorpay signature`,
          metadata: {
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            orderId: order.id,
          },
        },
      }),

      prisma.webhookLog.create({
        data: {
          id: `whk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          event: "payment.captured",
          payload: {
            entity: "event",
            account_id: "acc_razorai_live",
            event: "payment.captured",
            contains: ["payment"],
            payload: {
              payment: {
                entity: {
                  id: razorpay_payment_id,
                  entity: "payment",
                  amount: order.totalAmount,
                  currency: "INR",
                  status: "captured",
                  order_id: razorpay_order_id,
                  method: "upi_card",
                  description: `Order ${order.id} checkout settlement`,
                  created_at: Math.floor(Date.now() / 1000),
                },
              },
            },
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      orderId: order.id,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Payment verify error:", error);

    return res.status(500).json({
      message: "Payment verification failed",
    });
  }
});

// SIMULATE / REPORT Payment Failure (Failure Handling)
router.post("/fail", async (req: Request, res: Response) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const latestPayment = order.payments[0];

    await prisma.$transaction([
      ...(latestPayment
        ? [
            prisma.payment.update({
              where: { id: latestPayment.id },
              data: {
                status: "FAILED",
                failureReason: reason || "User cancelled or payment failed",
                razorpayPaymentId: razorpay_payment_id,
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                orderId: order.id,
                status: "FAILED",
                failureReason: reason || "User cancelled or payment failed",
                razorpayPaymentId: razorpay_payment_id,
                amount: order.totalAmount,
              },
            }),
          ]),

      prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      }),

      prisma.auditLog.create({
        data: {
          merchantId: order.merchantId,
          orderId: order.id,
          eventType: "PAYMENT",
          action: "PAYMENT_FAILED",
          description: `Payment failed for order ₹${order.totalAmount / 100}: ${reason || "User cancelled"}`,
          metadata: {
            reason: reason || "Payment cancelled",
            orderId: order.id,
            razorpayPaymentId: razorpay_payment_id,
          },
        },
      }),

      prisma.webhookLog.create({
        data: {
          id: `whk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          event: "payment.failed",
          payload: {
            entity: "event",
            account_id: "acc_razorai_live",
            event: "payment.failed",
            contains: ["payment"],
            payload: {
              payment: {
                entity: {
                  id: razorpay_payment_id || `pay_failed_${Date.now()}`,
                  entity: "payment",
                  amount: order.totalAmount,
                  currency: "INR",
                  status: "failed",
                  order_id: razorpay_order_id,
                  error_description: reason || "Payment cancelled by user",
                  created_at: Math.floor(Date.now() / 1000),
                },
              },
            },
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      }),
    ]);

    const failureMsg = reason || "Payment declined or cancelled";

    return res.json({
      success: false,
      orderId: order.id,
      status: "FAILED",
      message: "Payment failure recorded",
      explanation: "Payment failed. No successful charge was recorded for this order.",
      reason: failureMsg,
      canRetry: true,
    });
  } catch (error: any) {
    console.error("Payment fail error:", error);
    return res.status(500).json({ message: "Failed to record payment failure" });
  }
});

export default router;
