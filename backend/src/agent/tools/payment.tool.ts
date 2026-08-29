export async function requestPayment(input: {
  customerId: string;
  merchantId: string;
  orderId: string;
}) {
  return {
    type: "PAYMENT_APPROVAL_REQUIRED",
    customerId: input.customerId,
    merchantId: input.merchantId,
    orderId: input.orderId,
    message: "Customer approval is required before payment can be initiated.",
  };
}

// Backward compatibility alias for agent tool registry
export const createPaymentRequest = requestPayment;
