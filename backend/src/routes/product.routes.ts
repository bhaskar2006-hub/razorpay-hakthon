import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET all products
router.get("/", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// GET product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// CREATE product
router.post("/", async (req, res) => {
  try {
    const { merchantId, name, description, category, price, stock } = req.body;

    if (!merchantId || !name || !category || price == null || stock == null) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const product = await prisma.product.create({
      data: { merchantId, name, description, category, price, stock },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create product" });
  }
});

export default router;
