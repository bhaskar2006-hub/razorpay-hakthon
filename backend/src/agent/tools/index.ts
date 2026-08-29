import { searchProducts } from "./product.tool";
import { getProduct } from "./product-details.tool";
import { recommendUpsell } from "./recommendation.tool";
import { addToCart } from "./cart.tool";
import { createPaymentRequest } from "./payment.tool";

export const tools = {
  search_products: searchProducts,
  get_product: getProduct,
  recommend_upsell: recommendUpsell,
  add_to_cart: addToCart,
  create_payment_request: createPaymentRequest,
};

export {
  searchProducts,
  getProduct,
  recommendUpsell,
  addToCart,
  createPaymentRequest,
};
