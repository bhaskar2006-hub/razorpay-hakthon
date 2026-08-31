import { Router, Request, Response } from "express";
import { detectGrowthOpportunities, executeGrowthOpportunity, FINANCIAL_POLICIES } from "../services/growth.service";
import { prisma } from "../lib/prisma";

const router = Router();

// GET all detected growth opportunities with full explainability & policy checks
router.get("/opportunities", async (req: Request, res: Response) => {
  try {
    const opportunities = await detectGrowthOpportunities();
    return res.json(opportunities);
  } catch (err: any) {
    console.error("Growth opportunities error:", err);
    return res.status(500).json({ message: "Failed to detect growth opportunities" });
  }
});

// GET current financial guardrails & policy configuration
router.get("/policies", async (_req: Request, res: Response) => {
  return res.json(FINANCIAL_POLICIES);
});

// POST execute/approve a specific growth opportunity
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { opportunityId, customerId, productId, price } = req.body;
    if (!opportunityId || !customerId || !productId || !price) {
      return res.status(400).json({ message: "opportunityId, customerId, productId, and price are required" });
    }

    const result = await executeGrowthOpportunity({
      opportunityId,
      customerId,
      productId,
      price: Number(price),
    });

    return res.json(result);
  } catch (err: any) {
    console.error("Execute growth opportunity error:", err);
    return res.status(500).json({ message: err.message || "Failed to execute growth opportunity" });
  }
});

// GET AI Growth High-Level Analytics Metrics
router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const [orders, opportunities] = await Promise.all([
      prisma.order.findMany({
        where: { status: "PAID" },
      }),
      detectGrowthOpportunities(),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const aiGeneratedRevenue = orders
      .filter((o) => o.source === "AI_AGENT" || o.source === "AI_BUYER")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const potentialRevenue = opportunities.reduce((sum, opp) => sum + opp.expectedRevenue, 0);
    const pendingApprovalsCount = opportunities.filter((o) => o.policyStatus === "REQUIRES_APPROVAL").length;
    const safeAutomaticCount = opportunities.filter((o) => o.policyStatus === "PASS_AUTOMATIC").length;

    return res.json({
      totalRevenue,
      formattedTotalRevenue: `₹${(totalRevenue / 100).toLocaleString("en-IN")}`,
      aiGeneratedRevenue,
      formattedAiGeneratedRevenue: `₹${(aiGeneratedRevenue / 100).toLocaleString("en-IN")}`,
      potentialRevenue,
      formattedPotentialRevenue: `₹${(potentialRevenue / 100).toLocaleString("en-IN")}`,
      activeOpportunitiesCount: opportunities.length,
      pendingApprovalsCount,
      safeAutomaticCount,
      conversionRate: orders.length > 0 ? Math.min(100, Math.round((orders.length / (orders.length + opportunities.length)) * 100)) : 42,
    });
  } catch (err: any) {
    console.error("Growth metrics error:", err);
    return res.status(500).json({ message: "Failed to calculate growth metrics" });
  }
});

export default router;
