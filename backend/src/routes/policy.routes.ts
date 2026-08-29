import { Router, Request, Response } from "express";
import { evaluateTransaction } from "../services/policy.service";

const router = Router();

// POST /api/policy/evaluate
router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const { customerId, merchantId, amount, orderId, approval } = req.body;

    if (!customerId || !merchantId || amount == null) {
      return res.status(400).json({
        message: "customerId, merchantId, and amount are required",
      });
    }

    const result = await evaluateTransaction({
      customerId,
      merchantId,
      amount: Number(amount),
      orderId,
      approval: Boolean(approval),
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Policy evaluation error:", error);

    return res.status(500).json({
      message: "Policy evaluation failed",
      error: error.message,
    });
  }
});

export default router;
