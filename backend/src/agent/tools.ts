export const agentTools = [
  {
    name: "search_products",
    description:
      "Search the merchant catalog for products matching the customer's requirements.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Product category",
        },
        maxPrice: {
          type: "number",
          description: "Maximum price in paise",
        },
        query: {
          type: "string",
          description: "Search keywords",
        },
      },
    },
  },

  {
    name: "get_product",
    description:
      "Get complete information about a specific product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
        },
      },
      required: ["productId"],
    },
  },

  {
    name: "recommend_upsell",
    description:
      "Find relevant complementary products for the customer's selected product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
        },
      },
      required: ["productId"],
    },
  },
];
