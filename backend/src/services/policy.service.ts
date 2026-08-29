import { prisma } from "../lib/prisma";

export interface TransactionRequest {
  customerId: string;
  merchantId: string;
  amount: number;
  orderId?: string;
  approval: boolean;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: "ALLOW" | "BLOCK";
  reasons: string[];
  checks: {
    customerApproved: boolean;
    customerExists: boolean;
    merchantExists: boolean;
    merchantLimit: boolean;
    orderNotAlreadyPaid: boolean;
  };
  amountFormatted: string;
}

export async function evaluateTransaction(
  request: TransactionRequest
): Promise<PolicyEvaluationResult> {
  const reasons: string[] = [];

  const checks = {
    customerApproved: false,
    customerExists: false,
    merchantExists: false,
    merchantLimit: false,
    orderNotAlreadyPaid: true,
  };

  // 1. Explicit approval
  if (request.approval === true) {
    checks.customerApproved = true;
  } else {
    reasons.push("Customer approval is required");
  }

  // 2. Customer exists
  const customer = await prisma.customer.findUnique({
    where: {
      id: request.customerId,
    },
  });

  if (customer) {
    checks.customerExists = true;
  } else {
    reasons.push("Customer not found");
  }

  // 3. Merchant exists
  const merchant = await prisma.merchant.findUnique({
    where: {
      id: request.merchantId,
    },
  });

  if (merchant) {
    checks.merchantExists = true;

    // 4. Transaction limit check
    if (request.amount <= merchant.maxTransactionAmount) {
      checks.merchantLimit = true;
    } else {
      reasons.push(
        `Transaction of ₹${(request.amount / 100).toLocaleString(
          "en-IN"
        )} exceeds merchant limit of ₹${(
          merchant.maxTransactionAmount / 100
        ).toLocaleString("en-IN")}`
      );
    }
  } else {
    reasons.push("Merchant not found");
  }

  // 5. Existing order check (Idempotency & state check)
  if (request.orderId) {
    const order = await prisma.order.findUnique({
      where: {
        id: request.orderId,
      },
    });

    if (!order) {
      reasons.push("Order not found");
      checks.orderNotAlreadyPaid = false;
    } else if (order.status === "PAID") {
      reasons.push("Order has already been paid");
      checks.orderNotAlreadyPaid = false;
    }
  }

  const allowed = reasons.length === 0;
  const decision = allowed ? "ALLOW" : "BLOCK";

  // 6. Audit Trail Logging for Policy Decision
  if (merchant) {
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        orderId: request.orderId || null,
        eventType: "SECURITY",
        action: "POLICY_EVALUATION",
        description: `Policy evaluation ${decision}: ₹${(
          request.amount / 100
        ).toLocaleString("en-IN")} (${
          allowed ? "Passed all checks" : reasons.join("; ")
        })`,
        metadata: {
          decision,
          allowed,
          reasons,
          checks,
          amountPaise: request.amount,
          customerId: request.customerId,
        },
      },
    });
  }

  return {
    allowed,
    decision,
    reasons,
    checks,
    amountFormatted: `₹${(request.amount / 100).toLocaleString("en-IN")}`,
  };
}
