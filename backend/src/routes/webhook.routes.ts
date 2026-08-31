import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("RAZORPAY_WEBHOOK_SECRET is not configured");
      return res.status(500).json({
        message: "Webhook secret not configured",
      });
    }

    const signature = req.headers["x-razorpay-signature"];

    if (!signature || typeof signature !== "string") {
      return res.status(400).json({
        message: "Missing webhook signature",
      });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({
        message: "Invalid webhook signature",
      });
    }

    const payload =
      typeof req.body === "object" && !Buffer.isBuffer(req.body)
        ? req.body
        : JSON.parse(rawBody);

    const event = payload.event;

    // Log the webhook to DB for visual stream
    try {
      await prisma.webhookLog.create({
        data: {
          event: event || "unknown",
          payload: payload,
        },
      });
    } catch (dbErr) {
      console.error("Failed to log webhook in DB:", dbErr);
    }

    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;

      const order = await prisma.order.findUnique({
        where: {
          razorpayOrderId: payment.order_id,
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

      if (order.status === "PAID") {
        await prisma.auditLog.create({
          data: {
            merchantId: order.merchantId,
            orderId: order.id,
            eventType: "SECURITY",
            action: "DUPLICATE_WEBHOOK_IGNORED",
            description: `Duplicate webhook for payment ${payment.id} ignored. Order ${order.id} already settled.`,
            metadata: {
              paymentId: payment.id,
              orderId: order.id,
              status: order.status,
            },
          },
        });

        return res.json({
          received: true,
          status: "ALREADY_PROCESSED",
          message: "Order has already been settled. Duplicate event ignored.",
        });
      }

      const latestPayment = order.payments[0];

      await prisma.$transaction([
        ...(latestPayment
          ? [
              prisma.payment.update({
                where: { id: latestPayment.id },
                data: {
                  razorpayPaymentId: payment.id,
                  status: "CAPTURED",
                },
              }),
            ]
          : [
              prisma.payment.create({
                data: {
                  orderId: order.id,
                  razorpayPaymentId: payment.id,
                  amount: order.totalAmount,
                  status: "CAPTURED",
                },
              }),
            ]),

        prisma.order.update({
          where: {
            id: order.id,
          },
          data: {
            status: "PAID",
          },
        }),

        prisma.auditLog.create({
          data: {
            merchantId: order.merchantId,
            orderId: order.id,
            eventType: "PAYMENT",
            action: "PAYMENT_CAPTURED",
            description: `Razorpay webhook confirmed payment ${payment.id}`,
            metadata: {
              paymentId: payment.id,
              orderId: order.id,
            },
          },
        }),
      ]);
    }

    if (event === "payment.failed") {
      const payment = payload.payload.payment.entity;

      const order = await prisma.order.findUnique({
        where: {
          razorpayOrderId: payment.order_id,
        },
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (order) {
        const latestPayment = order.payments[0];
        const failureReason = payment.error_description || "Payment failed via webhook";

        await prisma.$transaction([
          ...(latestPayment
            ? [
                prisma.payment.update({
                  where: { id: latestPayment.id },
                  data: {
                    status: "FAILED",
                    failureReason,
                    razorpayPaymentId: payment.id,
                  },
                }),
              ]
            : [
                prisma.payment.create({
                  data: {
                    orderId: order.id,
                    status: "FAILED",
                    failureReason,
                    razorpayPaymentId: payment.id,
                    amount: order.totalAmount,
                  },
                }),
              ]),

          prisma.order.update({
            where: {
              id: order.id,
            },
            data: {
              status: "FAILED",
            },
          }),

          prisma.auditLog.create({
            data: {
              merchantId: order.merchantId,
              orderId: order.id,
              eventType: "PAYMENT",
              action: "PAYMENT_FAILED",
              description: `Razorpay reported payment failure: ${failureReason}`,
              metadata: {
                paymentId: payment.id,
                reason: failureReason,
                orderId: order.id,
              },
            },
          }),
        ]);
      }
    }

    return res.json({
      received: true,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    return res.status(500).json({
      message: "Webhook processing failed",
    });
  }
});

// SIMULATE live Razorpay Webhook Event for Terminal testing
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const eventType = req.body?.eventType || "payment.captured";
    const sampleAmount = req.body?.amount || 6499900;
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderId = `order_${Math.random().toString(36).slice(2, 10)}`;

    const simulatedPayload = {
      entity: "event",
      account_id: "acc_razorai_live",
      event: eventType,
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: "payment",
            amount: sampleAmount,
            currency: "INR",
            status: eventType === "payment.failed" ? "failed" : "captured",
            order_id: orderId,
            method: "upi",
            description: "Autonomous AI Agent Checkout Payment",
            email: "shopper@razorai.demo",
            contact: "+919876543210",
            fee: Math.floor(sampleAmount * 0.02),
            tax: Math.floor(sampleAmount * 0.0036),
            error_code: eventType === "payment.failed" ? "BAD_REQUEST_ERROR" : null,
            error_description: eventType === "payment.failed" ? "Payment failed due to bank timeout" : null,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const newLog = await prisma.webhookLog.create({
      data: {
        id: `whk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        event: eventType,
        payload: simulatedPayload,
      },
    });

    return res.json({
      success: true,
      log: newLog,
      message: `Simulated ${eventType} event streamed to terminal`,
    });
  } catch (err: any) {
    console.error("Webhook simulate error:", err);
    return res.status(500).json({ message: "Failed to simulate webhook" });
  }
});

// GET webhook logs for Live Terminal
router.get("/logs", async (req: Request, res: Response) => {
  try {
    const logs = await prisma.webhookLog.findMany({
      orderBy: { receivedAt: "desc" },
      take: 25,
    });
    return res.json(logs || []);
  } catch (err) {
    console.error("Failed to fetch webhook logs:", err);
    return res.json([]);
  }
});

// DELETE webhook logs to clear terminal
router.delete("/logs", async (req: Request, res: Response) => {
  try {
    await prisma.webhookLog.deleteMany();
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: true });
  }
});

export default router;
