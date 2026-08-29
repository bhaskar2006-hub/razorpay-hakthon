import { runAgentConversation } from "../ai/ai.service";
import { executeTool } from "./tool-executor";
import { prisma } from "../lib/prisma";

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
  const lower = params.message.toLowerCase();

  if (lower.includes("gaming laptop") || lower.includes("laptop")) {
    const maxPrice =
      lower.includes("70") || lower.includes("70000") || lower.includes("70k")
        ? 7000000
        : undefined;

    const productsResult = await executeTool("search_products", {
      category: "gaming-laptop",
      maxPrice,
    });

    const products = Array.isArray(productsResult) ? productsResult : [];
    const primaryProduct = products.length > 0 ? products[0] : null;

    let upsell: any[] = [];
    if (primaryProduct && "id" in primaryProduct) {
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
          description: "Agent searched products for gaming laptop query",
          metadata: { productsFound: products.length },
        },
      });
    }

    const recItem = upsell.length > 0 ? upsell[0] : null;
    const productName = primaryProduct ? (primaryProduct as any).name : "Gaming Laptop";
    const productPrice = primaryProduct ? (primaryProduct as any).price : 0;

    const recText = recItem
      ? ` Since you're looking at ${productName}, I also recommend the ${
          recItem.name
        } for ₹${(recItem.price / 100).toLocaleString("en-IN")}. Would you like to add it?`
      : "";

    return {
      message: `I found a gaming laptop that fits your budget: ${productName} for ₹${(
        productPrice / 100
      ).toLocaleString("en-IN")}.${recText}`,
      products,
      recommendations: upsell,
      toolCalls: [
        {
          toolName: "search_products",
          args: { category: "gaming-laptop", maxPrice },
          result: products,
        },
        ...(primaryProduct
          ? [
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
      "Tell me what product you're looking for and your budget, and I'll find the best options in our catalog!",
    toolCalls: [],
  };
}
