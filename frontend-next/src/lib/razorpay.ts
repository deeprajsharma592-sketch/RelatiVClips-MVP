export type RazorpayPayment = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayOrder = {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  plan?: string | null;
  description?: string;
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler: (payment: RazorpayPayment) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => {
      open: () => void;
      on: (event: string, callback: (data: { error?: { description?: string } }) => void) => void;
    };
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/proxy/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof result.detail === "string"
      ? result.detail
      : response.status === 401
        ? "Please sign in before paying."
        : "Payment request failed. Please try again.";
    throw new Error(message);
  }
  return result as T;
}

export function createRazorpayOrder(input: { plan: string } | { amount: number; currency: "INR" }) {
  return post<RazorpayOrder>("create-order", input);
}

export function verifyRazorpayPayment(payment: RazorpayPayment) {
  return post<{ success: boolean; status: string; message?: string }>("verify-payment", payment);
}

export function openRazorpayCheckout(
  order: RazorpayOrder,
  callbacks: {
    onSuccess: (payment: RazorpayPayment) => void;
    onDismiss: () => void;
    onFailure: (message: string) => void;
  },
) {
  if (!window.Razorpay) throw new Error("Razorpay Checkout is still loading. Please try again.");
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || order.key_id;
  if (!key) throw new Error("Razorpay public key is not configured.");
  const checkout = new window.Razorpay({
    key,
    amount: order.amount,
    currency: order.currency,
    order_id: order.order_id,
    name: "RelatiV",
    description: order.description,
    handler: callbacks.onSuccess,
    modal: { ondismiss: callbacks.onDismiss },
  });
  checkout.on("payment.failed", (data) => {
    callbacks.onFailure(data.error?.description || "Payment failed. Please try again.");
  });
  checkout.open();
}
