import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      merchantId,
      productId,
      quantity = 1,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product || !product.active) {
      return res.status(404).json({
        message: "Product unavailable",
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Requested: ${quantity}, Available: ${product.stock}`,
      });
    }

    const total = product.price * quantity;
    const targetMerchantId = merchantId || product.merchantId;

    const merchant = await prisma.merchant.findUnique({
      where: {
        id: targetMerchantId,
      },
    });

    if (!merchant) {
      return res.status(404).json({
        message: "Merchant not found",
      });
    }

    if (total > merchant.maxTransactionAmount) {
      return res.status(400).json({
        message: `Transaction ₹${total / 100} exceeds merchant limit of ₹${
          merchant.maxTransactionAmount / 100
        }`,
      });
    }

    // Record Purchase Intent creation in Audit Trail
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        eventType: "ORDER",
        action: "PURCHASE_INTENT_CREATED",
        description: `AI Buyer generated purchase intent for ${product.name} (₹${
          total / 100
        })`,
        metadata: {
          customerId,
          productId: product.id,
          productName: product.name,
          quantity,
          totalPaise: total,
        },
      },
    });

    return res.json({
      status: "APPROVAL_REQUIRED",

      purchaseIntent: {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        total,
        formattedTotal: `₹${(total / 100).toLocaleString("en-IN")}`,
        currency: "INR",
      },

      approval: {
        required: true,
        message: `Approval required for ₹${(total / 100).toLocaleString(
          "en-IN"
        )}`,
      },
    });
  } catch (error: any) {
    console.error("Purchase intent error:", error);

    return res.status(500).json({
      message: error.message || "Unable to create purchase intent",
    });
  }
});

export default router;
