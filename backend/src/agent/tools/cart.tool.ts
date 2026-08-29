import { prisma } from "../../lib/prisma";

export async function addToCart(input: {
  customerId: string;
  productId: string;
  quantity?: number;
}) {
  const quantity = input.quantity || 1;
  let cart = await prisma.cart.findUnique({
    where: { customerId: input.customerId },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { customerId: input.customerId },
    });
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId: input.productId,
      },
    },
  });

  if (existingItem) {
    return prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity },
      include: { product: true },
    });
  }

  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: input.productId,
      quantity,
    },
    include: { product: true },
  });
}

export async function getCart(customerId: string) {
  const cart = await prisma.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!cart) {
    return {
      id: "",
      customerId,
      items: [] as any[],
      total: 0,
      formattedTotal: "₹0",
    };
  }

  const total = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return {
    ...cart,
    total,
    formattedTotal: `₹${(total / 100).toLocaleString("en-IN")}`,
  };
}

export async function clearCart(customerId: string) {
  const cart = await prisma.cart.findUnique({ where: { customerId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
  return { success: true };
}
