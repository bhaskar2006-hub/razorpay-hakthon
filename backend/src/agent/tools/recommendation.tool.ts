import { prisma } from "../../lib/prisma";

export async function recommendUpsell(
  input: string | { productId?: string; category?: string }
) {
  const productId = typeof input === "string" ? input : input?.productId;

  let productCategory = typeof input === "object" ? input?.category : undefined;

  if (productId) {
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (product) {
      productCategory = product.category;
    }
  }

  const recommendations = await prisma.product.findMany({
    where: {
      active: true,
      ...(productId ? { id: { not: productId } } : {}),
      category: {
        contains: "accessories",
        mode: "insensitive",
      },
      stock: {
        gt: 0,
      },
    },
    orderBy: {
      price: "asc",
    },
    take: 3,
  });

  return recommendations;
}
