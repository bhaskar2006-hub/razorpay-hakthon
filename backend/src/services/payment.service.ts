import { prisma } from "../lib/prisma";
import { razorpay } from "../lib/razorpay";
import { evaluateTransaction } from "./policy.service";

export interface CreatePaymentInput {
  customerId: string;
  merchantId: string;
  orderId: string;
  approval: boolean;
}

export interface PaymentServiceResult {
  allowed: boolean;
  orderId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  reasons?: string[];
}

export async function createPaymentRequest(
  input: CreatePaymentInput
): Promise<PaymentServiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Never trust amount from the AI or client. Retrieve authoritative database amount.
  const amount = order.totalAmount;

  // Evaluate through Central Policy Engine
  const policy = await evaluateTransaction({
    customerId: input.customerId,
    merchantId: input.merchantId,
    orderId: order.id,
    amount,
    approval: input.approval,
  });

  if (!policy.allowed) {
    await prisma.auditLog.create({
      data: {
        merchantId: input.merchantId,
        orderId: order.id,
        eventType: "SECURITY",
        action: "PAYMENT_BLOCKED",
        description: `Payment blocked by Policy Engine: ${policy.reasons.join(
          "; "
        )}`,
        metadata: {
          reasons: policy.reasons,
          checks: policy.checks,
          orderId: order.id,
          amount,
        },
      },
    });

    return {
      allowed: false,
      reasons: policy.reasons,
    };
  }

  // Authoritative Gateway call — ONLY point of entry to Razorpay
  const razorpayOrder = await razorpay.orders.create({
    amount,
    currency: order.currency || "INR",
    receipt: order.id,
  });

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        razorpayOrderId: razorpayOrder.id,
        status: "PENDING",
      },
    }),

    prisma.payment.create({
      data: {
        orderId: order.id,
        amount,
        currency: order.currency || "INR",
        status: "CREATED",
      },
    }),

    prisma.auditLog.create({
      data: {
        merchantId: input.merchantId,
        orderId: order.id,
        eventType: "PAYMENT",
        action: "PAYMENT_CREATED",
        description: `Razorpay payment created for ₹${amount / 100}`,
        metadata: {
          razorpayOrderId: razorpayOrder.id,
          amount,
          currency: order.currency,
        },
      },
    }),
  ]);

  return {
    allowed: true,
    orderId: order.id,
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: order.currency,
  };
}
