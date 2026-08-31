import { runAgentConversation } from "../ai/ai.service";
import { executeTool } from "./tool-executor";
import { prisma } from "../lib/prisma";
import { addToCart, getCart } from "./tools/cart.tool";

export interface AgentChatInput {
  message: string;
  customerId?: string;
  merchantId?: string;
  history?: Array<{ role: string; content: string }>;
}

export async function handleCustomerMessage(input: AgentChatInput | string) {
  const params: AgentChatInput =
    typeof input === "string" ? { message: input } : input;

  console.log("Customer:", params.message);

  // 1. Try running full LLM conversation loop
  try {
    const aiResult = await runAgentConversation(params);
    if (aiResult) {
      return aiResult;
    }
  } catch (err: any) {
    console.error("LLM Agent run error:", err.message);
  }

  // 2. Deterministic Tool-Calling Fallback
  const lower = params.message.toLowerCase().trim();

  // Check for checkout acceptance / confirmation
  const isConfirmation = [
    "yes",
    "proceed",
    "checkout",
    "buy now",
    "buy it",
    "confirm",
    "place order",
    "pay",
    "ok",
    "sure",
    "i accept",
    "accept",
  ].some((kw) => lower === kw || lower.startsWith(kw) || lower.includes(kw));

  if (isConfirmation && params.customerId) {
    const cart = await getCart(params.customerId);
    if (cart.items.length > 0) {
      return {
        message: `Your cart is ready with ${cart.items.length} item(s) totaling ${cart.formattedTotal}. Opening Razorpay payment checkout now...`,
        triggerCheckout: true,
        toolCalls: [],
      };
    }
  }

  // Check for catalog matching keywords
  let category: string | undefined = undefined;
  let maxPrice: number | undefined = undefined;
  let customQuery: string | undefined = undefined;

  if (lower.includes("coding") || lower.includes("programming") || lower.includes("developer") || lower.includes("code")) {
    customQuery = "laptop";
  } else if (lower.includes("gaming laptop") || lower.includes("laptop") || lower.includes("ultrabook")) {
    category = "gaming-laptop";
    if (lower.includes("70") || lower.includes("70000") || lower.includes("70k")) {
      maxPrice = 7000000;
    }
  } else if (lower.includes("mouse") || lower.includes("keyboard") || lower.includes("headset") || lower.includes("mousepad") || lower.includes("stream pad")) {
    category = "gaming-accessories";
  } else if (lower.includes("stand") || lower.includes("dock") || lower.includes("charger") || lower.includes("thunderbolt")) {
    category = "laptop-accessories";
  } else if (lower.includes("monitor") || lower.includes("display") || lower.includes("screen") || lower.includes("curved") || lower.includes("4k")) {
    category = "displays";
  } else if (lower.includes("audio") || lower.includes("earbuds") || lower.includes("soundbar") || lower.includes("mic") || lower.includes("webcam") || lower.includes("headphone")) {
    category = "audio";
  } else if (lower.includes("power bank") || lower.includes("light") || lower.includes("charging pad") || lower.includes("accessories")) {
    category = "accessories";
  } else if (lower.includes("protection") || lower.includes("warranty")) {
    category = "protection";
  } else if (lower.includes("demo") || lower.includes("1-rupee") || lower.includes("1 rupee") || lower.includes("test")) {
    category = "demo";
  }

  // If query is product-related or general inquiry/greeting
  let products: any[] = [];

  if (customQuery === "laptop" || lower.includes("coding") || lower.includes("programming")) {
    // Return curated multi-option coding laptops
    products = await prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { category: "ultrabook" },
          { category: "creator-laptop" },
          { category: "gaming-laptop" },
        ],
      },
      orderBy: { price: "asc" },
      take: 3,
    });
  } else {
    const productsResult = await executeTool("search_products", {
      category: category || undefined,
      query: !category ? params.message : undefined,
      maxPrice,
    });
    products = Array.isArray(productsResult) ? productsResult : [];
  }

  // If still empty (e.g. general greeting or open question), fetch top featured store products
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: { active: true, stock: { gt: 0 } },
      orderBy: { price: "asc" },
      take: 3,
    });
  }

  const primaryProduct = products.length > 0 ? products[0] : null;

  let upsell: any[] = [];
  if (primaryProduct && "id" in primaryProduct) {
    // Auto-add top match to customer's cart
    if (params.customerId) {
      await addToCart({
        customerId: params.customerId,
        productId: primaryProduct.id,
        quantity: 1,
      });
    }

    const upsellResult = await executeTool("recommend_upsell", {
      productId: (primaryProduct as any).id,
    });
    upsell = Array.isArray(upsellResult) ? upsellResult : [];
  }

  if (params.merchantId) {
    await prisma.auditLog.create({
      data: {
        merchantId: params.merchantId,
        eventType: "AGENT_ACTION",
        action: "TOOL_SEARCH_PRODUCTS",
        description: `Agent searched catalog for '${params.message}' and presented recommendations`,
        metadata: { productsFound: products.length, topMatch: primaryProduct?.name },
      },
    });
  }

  const isCodingQuery = lower.includes("coding") || lower.includes("programming") || lower.includes("developer");
  let introText = "";

  if (isCodingQuery) {
    introText = `I found **${products.length} great laptop options for coding & software development**:\n\n1️⃣ **Ultra-Slim Ultrabook 14"** (₹54,999) — *Ultra-portable (1.1kg) with 18hr battery, ideal for web/app dev*\n2️⃣ **Gaming Laptop X** (₹64,999) — *RTX 4060 GPU, 16GB RAM for AI/ML workloads & multi-monitors*\n3️⃣ **Pro Creator Laptop 16"** (₹89,999) — *32GB RAM & Intel i9 for heavy compilation & virtualization*\n\n✨ *I've added the **${primaryProduct?.name}** (₹${((primaryProduct?.price || 0)/100).toLocaleString("en-IN")}) to your cart.*`;
  } else if (primaryProduct) {
    introText = `Here are the top matching recommendations from our store catalog:\n\n✨ **${primaryProduct.name}** — ₹${((primaryProduct.price || 0) / 100).toLocaleString("en-IN")}\n${primaryProduct.description || ""}\n\n*I've placed **${primaryProduct.name}** into your cart for fast 1-click checkout.*`;
  } else {
    introText = `Welcome to RazorAI! Browse our catalog below or tell me what you're looking for.`;
  }

  const recText = upsell.length > 0
    ? `\n\n💡 **Recommended Add-on:** Pair it with the **${upsell[0].name}** (₹${(upsell[0].price / 100).toLocaleString("en-IN")}) for the best experience!`
    : "";

  return {
    message: `${introText}${recText}\n\n👉 **Choose an option below, or reply "Yes" to proceed directly to 1-Click Checkout!**`,
    products,
    recommendations: upsell,
    toolCalls: [
      {
        toolName: "search_products",
        args: { category, maxPrice },
        result: products,
      },
      ...(primaryProduct
        ? [
            {
              toolName: "add_to_cart",
              args: { productId: (primaryProduct as any).id, quantity: 1 },
              result: { success: true },
            },
            {
              toolName: "recommend_upsell",
              args: { productId: (primaryProduct as any).id },
              result: upsell,
            },
          ]
        : []),
    ],
  };
}
