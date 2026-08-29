import { searchProducts } from "./tools/product.tool";
import { getProduct } from "./tools/product-details.tool";
import { recommendUpsell } from "./tools/recommendation.tool";

export async function executeTool(
  name: string,
  args: any
) {
  switch (name) {
    case "search_products":
      return searchProducts(args);

    case "get_product":
      return getProduct(args.productId);

    case "recommend_upsell":
      return recommendUpsell(args.productId);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
