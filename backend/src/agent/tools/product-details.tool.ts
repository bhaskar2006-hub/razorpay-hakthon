import { prisma } from "../../lib/prisma";

export async function getProduct(productId: string) {
  return prisma.product.findUnique({
    where: {
      id: productId,
      active: true,
    },
  });
}
