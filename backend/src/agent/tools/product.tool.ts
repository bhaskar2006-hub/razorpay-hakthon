import { prisma } from "../../lib/prisma";

interface SearchProductsInput {
  query?: string;
  category?: string;
  maxPrice?: number;
}

export async function searchProducts(
  input: SearchProductsInput
) {
  const products = await prisma.product.findMany({
    where: {
      active: true,

      ...(input.category
        ? {
            category: {
              contains: input.category,
              mode: "insensitive",
            },
          }
        : {}),

      ...(input.maxPrice
        ? {
            price: {
              lte: input.maxPrice,
            },
          }
        : {}),
    },

    orderBy: {
      price: "asc",
    },

    take: 10,
  });

  return products;
}
