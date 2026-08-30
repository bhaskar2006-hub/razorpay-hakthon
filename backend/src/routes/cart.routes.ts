import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// Add product to cart
router.post("/", async (req, res) => {
  try {
    const { customerId, productId, quantity = 1 } = req.body;

    if (!customerId || !productId) {
      return res.status(400).json({
        message: "customerId and productId are required",
      });
    }

    // Ensure customer exists or fallback to first customer
    let validCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!validCustomer) {
      validCustomer = await prisma.customer.findFirst();
      if (!validCustomer) {
        validCustomer = await prisma.customer.create({
          data: { name: "Demo Customer", email: "demo@razorai.demo" },
        });
      }
    }
    const targetCustomerId = validCustomer.id;

    let cart = await prisma.cart.findUnique({
      where: {
        customerId: targetCustomerId,
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          customerId: targetCustomerId,
        },
      });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (existingItem) {
      const updatedItem = await prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      });

      return res.json(updatedItem);
    }

    const item = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to add product to cart",
    });
  }
});

// Get cart
router.get("/:customerId", async (req, res) => {
  try {
    let customerId = req.params.customerId;
    const exists = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!exists) {
      const firstCust = await prisma.customer.findFirst();
      if (firstCust) customerId = firstCust.id;
    }

    const cart = await prisma.cart.findUnique({
      where: {
        customerId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return res.json({
        items: [],
        total: 0,
      });
    }

    const total = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    return res.json({
      ...cart,
      total,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch cart",
    });
  }
});

// Remove item from cart
router.delete("/:customerId/:productId", async (req, res) => {
  try {
    let customerId = req.params.customerId;
    const exists = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!exists) {
      const firstCust = await prisma.customer.findFirst();
      if (firstCust) customerId = firstCust.id;
    }

    const cart = await prisma.cart.findUnique({
      where: {
        customerId,
      },
    });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found",
      });
    }

    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId: req.params.productId,
      },
    });

    return res.json({
      message: "Item removed",
    });
  } catch (error) {
    console.error("Cart item deletion error:", error);

    return res.status(500).json({
      message: "Failed to remove item",
    });
  }
});

// Clear all items from cart
router.delete("/:customerId", async (req, res) => {
  try {
    let customerId = req.params.customerId;
    const exists = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!exists) {
      const firstCust = await prisma.customer.findFirst();
      if (firstCust) customerId = firstCust.id;
    }

    const cart = await prisma.cart.findUnique({
      where: {
        customerId,
      },
    });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });
    }

    return res.json({
      message: "Cart cleared",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({
      message: "Failed to clear cart",
    });
  }
});

export default router;
