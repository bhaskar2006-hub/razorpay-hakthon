import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/catalog/ai — Agent-readable structured catalog
router.get("/ai", async (_req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findFirst();

    const products = await prisma.product.findMany({
      where: {
        active: true,
        stock: {
          gt: 0,
        },
      },
      select: {
        id: true,
        merchantId: true,
        name: true,
        description: true,
        category: true,
        price: true,
        stock: true,
      },
    });

    return res.json({
      merchant: {
        id: merchant?.id || "",
        name: merchant?.name || "RazorAI Demo Store",
        currency: "INR",
        maxTransactionLimit: merchant?.maxTransactionAmount || 10000000,
      },

      products: products.map((product) => ({
        id: product.id,
        merchantId: product.merchantId,
        name: product.name,
        description: product.description,
        category: product.category,

        // AI-readable price
        price: {
          amount: product.price,
          formatted: `₹${(product.price / 100).toLocaleString("en-IN")}`,
          currency: "INR",
          unit: "paise",
        },

        availability: product.stock > 0,

        stock: {
          available: product.stock,
        },
      })),
    });
  } catch (error) {
    console.error("AI catalog error:", error);

    return res.status(500).json({
      message: "Unable to fetch AI catalog",
    });
  }
});

export default router;
