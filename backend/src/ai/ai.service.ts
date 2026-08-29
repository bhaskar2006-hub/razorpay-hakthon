import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { executeTool } from "../agent/tool-executor";
import { SYSTEM_PROMPT } from "../agent/system-prompt";
import { prisma } from "../lib/prisma";

const searchProductsDecl: FunctionDeclaration = {
  name: "search_products",
  description:
    "Search the merchant catalog for products matching the customer's requirements. Max price is in paise (1 INR = 100 paise).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "Product category (e.g. 'gaming-laptop', 'gaming-accessories', 'laptop-accessories', 'protection')",
      },
      maxPrice: {
        type: Type.INTEGER,
        description: "Maximum price in paise (e.g. 7000000 for ₹70,000)",
      },
      query: {
        type: Type.STRING,
        description: "Search keywords",
      },
    },
  },
};

const getProductDecl: FunctionDeclaration = {
  name: "get_product",
  description: "Get complete information about a specific product by ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "Product ID",
      },
    },
    required: ["productId"],
  },
};

const recommendUpsellDecl: FunctionDeclaration = {
  name: "recommend_upsell",
  description:
    "Find relevant complementary products/accessories for the customer's selected product.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productId: {
        type: Type.STRING,
        description: "Product ID to find accessories for",
      },
    },
    required: ["productId"],
  },
};

export async function runAgentConversation(params: {
  message: string;
  merchantId?: string;
  customerId?: string;
  history?: Array<{ role: string; content: string }>;
}) {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return null; // Signals fallback should be used
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: any[] = [];

  if (params.history && params.history.length > 0) {
    for (const h of params.history) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }
  }

  contents.push({
    role: "user",
    parts: [{ text: params.message }],
  });

  const toolDeclarations = [
    searchProductsDecl,
    getProductDecl,
    recommendUpsellDecl,
  ];

  const executedToolCalls: Array<{
    toolName: string;
    args: any;
    result: any;
  }> = [];

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content) {
      break;
    }

    const modelParts = candidate.content.parts || [];
    contents.push(candidate.content);

    const functionCalls = modelParts.filter((p: any) => Boolean(p.functionCall));

    if (functionCalls.length === 0) {
      const responseText = modelParts
        .map((p: any) => p.text || "")
        .filter(Boolean)
        .join("\n");

      return {
        message: responseText,
        toolCalls: executedToolCalls,
      };
    }

    const toolResponseParts: any[] = [];

    for (const fcPart of functionCalls) {
      const fc = fcPart.functionCall;
      if (!fc || !fc.name) continue;

      const toolName: string = fc.name;
      const toolArgs: Record<string, any> = (fc.args as Record<string, any>) || {};

      let result: any = null;

      try {
        result = await executeTool(toolName, toolArgs);

        if (params.merchantId) {
          await prisma.auditLog.create({
            data: {
              merchantId: params.merchantId,
              eventType: "AGENT_ACTION",
              action: `TOOL_${toolName.toUpperCase()}`,
              description: `AI Agent executed tool: ${toolName}`,
              metadata: JSON.parse(
                JSON.stringify({
                  args: toolArgs,
                  resultSummary: Array.isArray(result)
                    ? `${result.length} items found`
                    : result,
                })
              ),
            },
          });
        }
      } catch (err: any) {
        result = { error: err.message || "Failed to execute tool" };
      }

      executedToolCalls.push({
        toolName,
        args: toolArgs,
        result,
      });

      toolResponseParts.push({
        functionResponse: {
          name: toolName,
          response: { result },
        },
      });
    }

    contents.push({
      role: "user",
      parts: toolResponseParts,
    });
  }

  return {
    message: "I processed your request.",
    toolCalls: executedToolCalls,
  };
}
