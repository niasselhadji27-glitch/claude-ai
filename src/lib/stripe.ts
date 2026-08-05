import Stripe from "stripe";
import type { SubscriptionTier } from "@/lib/types";

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2024-12-18.acacia",
  });
}

export function priceIdForTier(tier: Exclude<SubscriptionTier, "free">) {
  const map = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    agency: process.env.STRIPE_PRICE_AGENCY,
  } as const;
  return map[tier];
}

export function tierForPriceId(priceId: string): SubscriptionTier | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  return null;
}
