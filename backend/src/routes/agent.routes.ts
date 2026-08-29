import { Router, Request, Response } from "express";
import { handleCustomerMessage } from "../agent/agent.service";

const router = Router();

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, customerId, merchantId, history } = req.body;

    if (!message) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const result = await handleCustomerMessage({
      message,
      customerId,
      merchantId,
      history,
    });

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Agent failed to process request",
    });
  }
});

export default router;
