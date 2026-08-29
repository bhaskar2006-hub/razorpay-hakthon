import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { prisma } from "../lib/prisma";
import { executeTool } from "../agent/tool-executor";
import { addToCart, getCart } from "../agent/tools/cart.tool";

export interface BuyerIntentRequest {
  goal: string;
  customerId: string;
  merchantId?: string;
  maxBudget?: number; // in paise
}

export const BUYER_SYSTEM_PROMPT = `
You are an autonomous AI Buyer Assistant acting on behalf of a customer.
Your goal is to search the merchant's catalog, find the best items matching the user's requirements and budget, assemble the cart, and prepare a purchase proposal.

RULES:
1. Always respect the user's budget constraint strictly.
2. Search and compare products using search_products and get_product.
3. Check for complementary accessories if appropriate and budget allows.
4. Add the chosen items to the customer's cart using add_to_cart.
5. Review the final cart using get_cart.
6. Provide a concise, clear explanation of why these items were selected, their itemized costs, and the exact total.
7. Explicitly state that checkout and payment are pending the user's one-click approval.
`;

const searchDecl: FunctionDeclaration = {
  name: "search_products",
  description: "Search merchant catalog for products. MaxPrice in paise (1 INR = 100 paise).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING },
      maxPrice: { type: Type.INTEGER },
      query: { type: Type.STRING },
    },
  },
};

const getProductDecl: FunctionDeclaration = {
  name: "get_product",
  description: "Get product details by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: { productId: { type: Type.STRING } },
    required: ["productId"],
  },
};

const recommendDecl: FunctionDeclaration = {
  name: "recommend_upsell",
  description: "Get complementary recommendations for a product.",
  parameters: {
    type: Type.OBJECT,
    properties: { productId: { type: Type.STRING } },
    required: ["productId"],
  },
};

const addToCartDecl: FunctionDeclaration = {
  name: "add_to_cart",
  description: "Add an item to the buyer's cart.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: { type: Type.STRING },
      quantity: { type: Type.INTEGER },
    },
    required: ["productId"],
  },
};

const getCartDecl: FunctionDeclaration = {
  name: "get_cart",
  description: "Get current cart items and total.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

export async function runBuyerAgent(params: BuyerIntentRequest) {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  const merchant = params.merchantId
    ? await prisma.merchant.findUnique({ where: { id: params.merchantId } })
    : await prisma.merchant.findFirst();

  const merchantId = merchant?.id || "";

  // Log start of Buyer Agent Session
  await prisma.auditLog.create({
    data: {
      merchantId,
      eventType: "AGENT_ACTION",
      action: "BUYER_AGENT_INVOKED",
      description: `AI Buyer started task: "${params.goal}"`,
      metadata: { customerId: params.customerId, budget: params.maxBudget },
    },
  });

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    // Fallback deterministic buyer flow
    const products = await executeTool("search_products", {
      category: "gaming-laptop",
      maxPrice: params.maxBudget || 7000000,
    });

    const laptop = Array.isArray(products) && products.length > 0 ? products[0] : null;
    let accessories: any[] = [];

    if (laptop) {
      await addToCart({
        customerId: params.customerId,
        productId: laptop.id,
        quantity: 1,
      });

      const upsells = await executeTool("recommend_upsell", { productId: laptop.id });
      accessories = Array.isArray(upsells) ? upsells : [];

      if (accessories.length > 0) {
        const mouse = accessories[0];
        const remainingBudget = (params.maxBudget || 7000000) - laptop.price;
        if (mouse.price <= remainingBudget) {
          await addToCart({
            customerId: params.customerId,
            productId: mouse.id,
            quantity: 1,
          });
        }
      }
    }

    const finalCart = await getCart(params.customerId);

    return {
      status: "APPROVAL_PENDING",
      agentRole: "Autonomous Buyer Proxy",
      summary: `I found the ${laptop?.name || "Gaming Laptop"} and bundled it with ${
        accessories[0]?.name || "accessories"
      } within your budget.`,
      cart: finalCart,
      totalAmount: finalCart.total,
      formattedTotal: finalCart.formattedTotal,
      requiresUserApproval: true,
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: any[] = [
    {
      role: "user",
      parts: [
        {
          text: `User Goal: "${params.goal}". Customer ID: ${params.customerId}. Max Budget in paise: ${
            params.maxBudget || 7000000
          }. Find the best matching products, add them to cart, verify the total, and present the proposal for payment approval.`,
        },
      ],
    },
  ];

  const tools = [searchDecl, getProductDecl, recommendDecl, addToCartDecl, getCartDecl];
  const executedSteps: any[] = [];
  let iterations = 0;

  while (iterations < 6) {
    iterations++;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: BUYER_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: tools }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content) break;

    const parts = candidate.content.parts || [];
    contents.push(candidate.content);

    const functionCalls = parts.filter((p: any) => Boolean(p.functionCall));

    if (functionCalls.length === 0) {
      const finalCart = await getCart(params.customerId);
      const text = parts
        .map((p: any) => p.text || "")
        .filter(Boolean)
        .join("\n");

      await prisma.auditLog.create({
        data: {
          merchantId,
          eventType: "AGENT_ACTION",
          action: "BUYER_AGENT_COMPLETED",
          description: `AI Buyer assembled cart total: ₹${(finalCart.total / 100).toLocaleString(
            "en-IN"
          )} awaiting approval`,
          metadata: { totalPaise: finalCart.total, stepsCount: executedSteps.length },
        },
      });

      return {
        status: "APPROVAL_PENDING",
        agentRole: "Autonomous Buyer Proxy",
        message: text,
        cart: finalCart,
        totalAmount: finalCart.total,
        formattedTotal: finalCart.formattedTotal,
        executedSteps,
        requiresUserApproval: true,
      };
    }

    const toolResponses: any[] = [];

    for (const fcPart of functionCalls) {
      const fc = fcPart.functionCall;
      if (!fc || !fc.name) continue;

      const toolName = fc.name;
      const toolArgs: Record<string, any> = (fc.args as Record<string, any>) || {};
      let result: any = null;

      try {
        if (toolName === "search_products") {
          result = await executeTool(toolName, toolArgs);
        } else if (toolName === "get_product") {
          result = await executeTool(toolName, toolArgs);
        } else if (toolName === "recommend_upsell") {
          result = await executeTool(toolName, toolArgs);
        } else if (toolName === "add_to_cart") {
          result = await addToCart({
            customerId: params.customerId,
            productId: String(toolArgs.productId || ""),
            quantity: typeof toolArgs.quantity === "number" ? toolArgs.quantity : 1,
          });
        } else if (toolName === "get_cart") {
          result = await getCart(params.customerId);
        }
      } catch (err: any) {
        result = { error: err.message };
      }

      executedSteps.push({ toolName, args: toolArgs, result });
      toolResponses.push({
        functionResponse: {
          name: toolName,
          response: { result },
        },
      });
    }

    contents.push({
      role: "user",
      parts: toolResponses,
    });
  }

  const finalCart = await getCart(params.customerId);
  return {
    status: "APPROVAL_PENDING",
    agentRole: "Autonomous Buyer Proxy",
    cart: finalCart,
    totalAmount: finalCart.total,
    formattedTotal: finalCart.formattedTotal,
    executedSteps,
    requiresUserApproval: true,
  };
}
