import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyPaymentSignature } from "../lib/payment-verification";

const router = Router();

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

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ id: orderId }] : []),
          ...(razorpay_order_id ? [{ razorpayOrderId: razorpay_order_id }] : []),
        ],
      },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const failureReason = reason || "Payment declined or cancelled by customer/bank";
    const paymentId = razorpay_payment_id || `failed_${Date.now()}`;
    const latestPayment = order.payments[0];

    await prisma.$transaction([
      ...(latestPayment
        ? [
            prisma.payment.update({
              where: { id: latestPayment.id },
              data: {
                status: "FAILED",
                failureReason,
                razorpayPaymentId: paymentId,
              },
            }),
          ]
        : [
            prisma.payment.create({
              data: {
                orderId: order.id,
                amount: order.totalAmount,
                status: "FAILED",
                failureReason,
                razorpayPaymentId: paymentId,
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
          description: `Payment failed for order ${order.id}: ${failureReason}`,
          metadata: {
            paymentId,
            reason: failureReason,
            orderId: order.id,
            amount: order.totalAmount,
          },
        },
      }),
    ]);

    return res.json({
      success: false,
      orderId: order.id,
      status: "FAILED",
      message: "Payment failure recorded",
      explanation: "Payment failed. No successful charge was recorded for this order.",
      reason: failureReason,
      canRetry: true,
    });
  } catch (error: any) {
    console.error("Payment fail error:", error);
    return res.status(500).json({ message: "Failed to record payment failure" });
  }
});

export default router;
