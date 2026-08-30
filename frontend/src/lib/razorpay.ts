export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function openRazorpayCheckout({
  orderId,
  razorpayOrderId,
  amount,
  currency = "INR",
  name = "RazorAI Store",
  description,
  customerName = "Bhaskar Reddy",
  customerEmail = "bhaskar@razorai.demo",
  onSuccess,
  onFailure,
  onDismiss,
}: {
  orderId: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  onSuccess: (response: RazorpayPaymentSuccessResponse) => void;
  onFailure?: (error: any) => void;
  onDismiss?: () => void;
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    alert("Razorpay SDK failed to load. Please check your internet connection.");
    if (onDismiss) onDismiss();
    return;
  }

  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TVfLfNjj6JvRnD";

  const options = {
    key: keyId,
    amount: amount,
    currency: currency,
    name: name,
    description: description || `Payment for Order #${orderId}`,
    order_id: razorpayOrderId,
    handler: function (response: RazorpayPaymentSuccessResponse) {
      onSuccess(response);
    },
    prefill: {
      name: customerName,
      email: customerEmail,
      contact: "9999999999",
    },
    notes: {
      orderId: orderId,
    },
    theme: {
      color: "#6366f1",
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      },
    },
  };

  const paymentObject = new (window as any).Razorpay(options);

  if (onFailure) {
    paymentObject.on("payment.failed", function (response: any) {
      onFailure(response.error);
    });
  }

  paymentObject.open();
}
