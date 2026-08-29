import { prisma } from "./prisma";

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
  subtotal: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

export async function validateOrderPolicy(params: {
  merchantId: string;
  customerId: string;
  cartItems: Array<{
    productId: string;
    quantity: number;
    product: {
      id: string;
      name: string;
      price: number;
      stock: number;
      active: boolean;
    };
  }>;
}): Promise<PolicyValidationResult> {
  const { merchantId, cartItems } = params;

  if (!cartItems || cartItems.length === 0) {
    return { allowed: false, reason: "Cart is empty", subtotal: 0, items: [] };
  }

  // 1. Fetch Merchant constraints
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) {
    return {
      allowed: false,
      reason: "Merchant not found or inactive",
      subtotal: 0,
      items: [],
    };
  }

  // 2. Authoritative Server-side recalculation & stock validation
  let subtotal = 0;
  const processedItems: PolicyValidationResult["items"] = [];

  for (const item of cartItems) {
    // Fetch latest fresh product data directly from DB
    const freshProduct = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!freshProduct || !freshProduct.active) {
      return {
        allowed: false,
        reason: `Product ${item.product.name || item.productId} is inactive or discontinued`,
        subtotal: 0,
        items: [],
      };
    }

    if (freshProduct.stock < item.quantity) {
      return {
        allowed: false,
        reason: `Insufficient stock for ${freshProduct.name} (requested: ${item.quantity}, available: ${freshProduct.stock})`,
        subtotal: 0,
        items: [],
      };
    }

    const itemTotal = freshProduct.price * item.quantity;
    subtotal += itemTotal;

    processedItems.push({
      productId: freshProduct.id,
      productName: freshProduct.name,
      quantity: item.quantity,
      unitPrice: freshProduct.price,
      totalPrice: itemTotal,
    });
  }

  // 3. Merchant Policy Bounding Check
  if (subtotal > merchant.maxTransactionAmount) {
    return {
      allowed: false,
      reason: `Order total ₹${(subtotal / 100).toLocaleString(
        "en-IN"
      )} exceeds merchant max transaction limit of ₹${(
        merchant.maxTransactionAmount / 100
      ).toLocaleString("en-IN")}`,
      subtotal,
      items: processedItems,
    };
  }

  return {
    allowed: true,
    subtotal,
    items: processedItems,
  };
}
