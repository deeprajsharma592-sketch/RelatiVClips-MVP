"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import {
  createRazorpayOrder,
  openRazorpayCheckout,
  verifyRazorpayPayment,
  type RazorpayPayment,
} from "@/lib/razorpay";

export default function CheckoutPage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [pending, setPending] = useState<RazorpayPayment | null>(null);
  const locked = useRef(false);
  const [paid, setPaid] = useState(false);

  async function verify(payment: RazorpayPayment) {
    setPending(payment);
    try {
      const result = await verifyRazorpayPayment(payment);
      if (result.success) { setPending(null); setPaid(true); setMessage("Payment received. Thank you!"); }
      else setMessage(result.message || "Awaiting confirmation. Do not pay again.");
    } catch (error) { setMessage(`${error instanceof Error ? error.message : "Could not verify payment."} Retry verification; do not pay again.`); }
    finally { locked.current = false; setBusy(false); }
  }

  async function checkout() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    if (pending) return verify(pending);
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error("Enter a valid amount with at most two decimal places.");
      const paise = Math.round(Number(amount) * 100);
      if (paise < 100 || paise > 10000000) throw new Error("Enter an amount between ₹1 and ₹100,000.");
      const order = await createRazorpayOrder({ amount: paise, currency: "INR" });
      let submitted = false;
      openRazorpayCheckout(order, {
        onSuccess: async (payment) => { submitted = true; await verify(payment); },
        onDismiss: () => { if (!submitted) { locked.current = false; setBusy(false); setMessage("Checkout closed. No payment was confirmed."); } },
        onFailure: (failure) => {
          locked.current = false;
          setBusy(false);
          setMessage(failure);
        },
      });
    } catch (error) { locked.current = false; setBusy(false); setMessage(error instanceof Error ? error.message : "Unable to open checkout."); }
  }

  return <main className="mx-auto max-w-lg px-6 py-24">
    <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setReady(true)} onError={() => setMessage("Could not load Razorpay. Reload this page to retry.")} />
    <h1 className="text-3xl font-semibold">RelatiV checkout</h1>
    <p className="mt-3 text-sm text-zinc-500">Make a one-time payment. This does not change your subscription.</p>
    <label htmlFor="payment-amount" className="mt-8 block text-sm">Amount (INR)</label>
    <input id="payment-amount" inputMode="decimal" value={amount} disabled={busy || paid || !!pending} onChange={event => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-500 p-3" />
    <button onClick={checkout} disabled={!ready || busy || paid} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{paid ? "Payment received" : busy ? "Processing…" : pending ? "Retry verification" : "Pay with Razorpay"}</button>
    <p role="status" aria-live="polite" className="mt-4 text-sm">{message}</p>
    <a href="/login?next=/checkout" className="mt-5 inline-block text-sm underline">Sign in to pay</a>
  </main>;
}
