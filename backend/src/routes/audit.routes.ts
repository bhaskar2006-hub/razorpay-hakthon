import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/audit — Fetch enriched audit trail events for visual timeline
router.get("/", async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        merchant: { select: { name: true } },
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            source: true,
            items: {
              include: {
                product: {
                  select: { id: true, name: true, category: true, price: true },
                },
              },
            },
          },
        },
      },
    });

    const formattedLogs = logs.map((log) => {
      const date = new Date(log.createdAt);
      const time = date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const meta = (log.metadata as Record<string, any>) || {};

      // Determine level/category
      let statusType = "INFO";
      if (log.action.includes("FAILED") || log.action.includes("BLOCKED") || log.action.includes("VIOLATION")) {
        statusType = "FAILURE";
      } else if (log.action.includes("CAPTURED") || log.action.includes("VERIFIED") || log.action.includes("APPROVED") || log.action.includes("ALLOW")) {
        statusType = "SUCCESS";
      } else if (log.action.includes("APPROVAL") || log.action.includes("GATE")) {
        statusType = "GATE";
      }

      const products = log.order?.items?.map((i) => ({
        id: i.product.id,
        name: i.product.name,
        category: i.product.category,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        formattedPrice: `₹${(i.unitPrice / 100).toLocaleString("en-IN")}`,
      })) || [];

      return {
        id: log.id,
        time,
        timestamp: log.createdAt,
        eventType: log.eventType,
        action: log.action,
        statusType,
        description: log.description,
        metadata: meta,
        orderId: log.orderId,
        orderStatus: log.order?.status,
        orderSource: log.order?.source,
        orderAmount: log.order ? `₹${(log.order.totalAmount / 100).toLocaleString("en-IN")}` : null,
        products,
      };
    });

    return res.json(formattedLogs);
  } catch (error: any) {
    console.error("Audit log fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

export default router;
