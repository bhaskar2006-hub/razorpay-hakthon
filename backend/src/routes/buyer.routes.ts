import { Router, Request, Response } from "express";
import { runBuyerAgent } from "../buyer/buyer.service";
import { prisma } from "../lib/prisma";

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

export default router;
