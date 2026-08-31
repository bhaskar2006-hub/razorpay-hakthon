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

  if (lower.includes("gaming laptop") || lower.includes("laptop")) {
    category = "gaming-laptop";
    if (lower.includes("70") || lower.includes("70000") || lower.includes("70k")) {
      maxPrice = 7000000;
    }
  } else if (lower.includes("mouse") || lower.includes("keyboard") || lower.includes("headset") || lower.includes("mousepad")) {
    category = "gaming-accessories";
  } else if (lower.includes("stand") || lower.includes("dock")) {
    category = "laptop-accessories";
  } else if (lower.includes("monitor") || lower.includes("display")) {
    category = "displays";
  } else if (lower.includes("protection") || lower.includes("warranty")) {
    category = "protection";
  } else if (lower.includes("demo") || lower.includes("1-rupee") || lower.includes("1 rupee")) {
    category = "demo";
  }

  if (category || lower.includes("buy") || lower.includes("find") || lower.includes("want")) {
    const productsResult = await executeTool("search_products", {
      category: category || undefined,
      query: !category ? params.message : undefined,
      maxPrice,
    });

    const products = Array.isArray(productsResult) ? productsResult : [];
    const primaryProduct = products.length > 0 ? products[0] : null;

    let upsell: any[] = [];
    if (primaryProduct && "id" in primaryProduct) {
      // Auto-add primary product to customer's cart
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
          description: `Agent searched catalog for '${params.message}' and prepared cart`,
          metadata: { productsFound: products.length, addedToCart: primaryProduct?.name },
        },
      });
    }

    const recItem = upsell.length > 0 ? upsell[0] : null;
    const productName = primaryProduct ? (primaryProduct as any).name : "Product";
    const productPrice = primaryProduct ? (primaryProduct as any).price : 0;

    const recText = recItem
      ? `\n\n💡 *Complementary Add-on:* I also recommend pairing it with **${recItem.name}** for ₹${(recItem.price / 100).toLocaleString("en-IN")}.`
      : "";

    return {
      message: `I found the best match for you and added it to your cart:\n\n✨ **${productName}** — ₹${(productPrice / 100).toLocaleString("en-IN")}${recText}\n\n👉 **Would you like to accept and proceed to checkout?** Reply **"Yes"** or click the checkout button below!`,
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

  return {
    message:
      "Tell me what product you're looking for (e.g. *Gaming Laptop under ₹70,000*, *Noise-Cancelling Headset*, *Mechanical Keyboard*), and I will find it and prepare your order!",
    toolCalls: [],
  };
}
