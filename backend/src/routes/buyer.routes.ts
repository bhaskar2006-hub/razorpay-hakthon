import { Router, Request, Response } from "express";
import { runBuyerAgent } from "../buyer/buyer.service";
import { prisma } from "../lib/prisma";
import { createPaymentRequest } from "../services/payment.service";

const router = Router();

// GET /api/buyer/customer (returns the primary demo customer)
router.get("/customer", async (_req: Request, res: Response) => {
  try {
    let customer = await prisma.customer.findFirst();
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: "Bhaskar Reddy",
          email: "bhaskar@razorai.demo",
        },
      });
    }
    return res.json(customer);
  } catch (error: any) {
    return res.status(500).json({ message: "Failed to fetch customer" });
  }
});

// POST /api/buyer/delegate
router.post("/delegate", async (req: Request, res: Response) => {
  try {
    const { goal, customerId, merchantId, maxBudget } = req.body;

    if (!goal || !customerId) {
      return res.status(400).json({
        message: "goal and customerId are required",
      });
    }

    const result = await runBuyerAgent({
      goal,
      customerId,
      merchantId,
      maxBudget,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Buyer Agent error:", error);
    return res.status(500).json({
      message: error.message || "Buyer Agent failed to execute task",
    });
  }
});

// GET /api/buyer/mandate/:customerId
router.get("/mandate/:customerId", async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    const customer = await prisma.customer.upsert({
      where: { id: customerId },
      update: {},
      create: {
        id: customerId,
        name: "Guest Shopper",
        email: `${customerId}@shopper.razorai.demo`,
        mandateActive: false,
        mandateLimitSingle: 500000,
        mandateLimitMonthly: 2000000,
        mandateSpentMonthly: 0,
      },
      select: {
        id: true,
        mandateActive: true,
        mandateLimitSingle: true,
        mandateLimitMonthly: true,
        mandateSpentMonthly: true,
        razorpayMandateToken: true,
      },
    });

    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch mandate details" });
  }
});

// POST /api/buyer/mandate/setup-intent
router.post("/mandate/setup-intent", async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ message: "customerId is required" });

    // Find the 1-Rupee demo item
    const product = await prisma.product.findFirst({
      where: { price: 100, category: "demo" },
    });

    if (!product) {
      return res.status(404).json({ message: "Demo 1-Rupee product not found. Run db:seed." });
    }

    // Ensure customer exists in database
    await prisma.customer.upsert({
      where: { id: customerId },
      update: {},
      create: {
        id: customerId,
        name: "Guest Shopper",
        email: `${customerId}@shopper.razorai.demo`,
      },
    });

    // Set cart to contain exactly this 1-Rupee product
    let cart = await prisma.cart.findUnique({ where: { customerId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { customerId } });
    }

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
    });

    // Create an order
    const order = await prisma.order.create({
      data: {
        merchantId: product.merchantId,
        customerId,
        subtotal: 100,
        totalAmount: 100,
        currency: "INR",
        source: "AI_BUYER",
        items: {
          create: [{
            productId: product.id,
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          }],
        },
      },
    });

    // Create Razorpay Order
    const paymentRequest = await createPaymentRequest({
      customerId,
      merchantId: product.merchantId,
      orderId: order.id,
      approval: true,
    });

    if (!paymentRequest.allowed) {
      return res.status(400).json({ message: "Blocked by policy engine" });
    }

    return res.json({
      orderId: order.id,
      razorpayOrderId: paymentRequest.razorpayOrderId,
      amount: 100,
      currency: "INR",
    });
  } catch (error) {
    console.error("Setup mandate intent error:", error);
    return res.status(500).json({ message: "Failed to setup mandate intent" });
  }
});

// POST /api/buyer/mandate
router.post("/mandate", async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      mandateActive,
      mandateLimitSingle,
      mandateLimitMonthly,
      resetSpent = false,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    // Generate simulated mandate token if activating
    const razorpayMandateToken = mandateActive
      ? "mandate_token_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
      : null;

    const dataToUpdate: any = {
      mandateActive,
    };

    if (razorpayMandateToken) {
      dataToUpdate.razorpayMandateToken = razorpayMandateToken;
    }

    if (typeof mandateLimitSingle === "number") {
      dataToUpdate.mandateLimitSingle = mandateLimitSingle;
    }

    if (typeof mandateLimitMonthly === "number") {
      dataToUpdate.mandateLimitMonthly = mandateLimitMonthly;
    }

    if (resetSpent) {
      dataToUpdate.mandateSpentMonthly = 0;
    }

    const updated = await prisma.customer.upsert({
      where: { id: customerId },
      update: dataToUpdate,
      create: {
        id: customerId,
        name: "Guest Shopper",
        email: `${customerId}@shopper.razorai.demo`,
        mandateActive: mandateActive || false,
        mandateLimitSingle: mandateLimitSingle || 500000,
        mandateLimitMonthly: mandateLimitMonthly || 2000000,
        mandateSpentMonthly: 0,
        razorpayMandateToken: razorpayMandateToken || undefined,
      },
      select: {
        id: true,
        mandateActive: true,
        mandateLimitSingle: true,
        mandateLimitMonthly: true,
        mandateSpentMonthly: true,
        razorpayMandateToken: true,
      },
    });

    // Create audit log for mandate setup/update
    const merchant = await prisma.merchant.findFirst();
    if (merchant) {
      await prisma.auditLog.create({
        data: {
          merchantId: merchant.id,
          eventType: "SECURITY",
          action: mandateActive ? "MANDATE_ACTIVATED" : "MANDATE_DEACTIVATED",
          description: mandateActive
            ? `Autopay mandate enabled (Single Cap: ₹${updated.mandateLimitSingle / 100}, Monthly Budget: ₹${updated.mandateLimitMonthly / 100})`
            : "Autopay mandate disabled by customer",
          metadata: { customerId, limits: updated },
        },
      });
    }

    return res.json(updated);
  } catch (error) {
    console.error("Failed to update mandate:", error);
    return res.status(500).json({ message: "Failed to update mandate details" });
  }
});

export default router;
