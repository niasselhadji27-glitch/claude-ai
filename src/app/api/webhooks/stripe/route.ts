import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, tierForPriceId } from "@/lib/stripe";
import { grantCredits } from "@/lib/credits";
import { TIER_CREDITS } from "@/lib/types";

/**
 * Stripe webhook: keeps profiles.subscription_tier/status in sync and
 * grants monthly credits on each successful subscription invoice.
 *
 * Events to enable in the Stripe dashboard:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.paid
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function userIdForCustomer(customerId: string): Promise<string | null> {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();
    return data?.id ?? null;
  }

  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await userIdForCustomer(sub.customer as string);
      if (!userId) break;
      const priceId = sub.items.data[0]?.price.id;
      const tier = priceId ? tierForPriceId(priceId) : null;
      await admin
        .from("profiles")
        .update({
          subscription_tier: tier ?? "free",
          subscription_status: sub.status,
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await userIdForCustomer(sub.customer as string);
      if (!userId) break;
      await admin
        .from("profiles")
        .update({ subscription_tier: "free", subscription_status: "canceled" })
        .eq("id", userId);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.customer) break;
      const userId = await userIdForCustomer(invoice.customer as string);
      if (!userId) break;
      const priceId = invoice.lines.data[0]?.price?.id;
      const tier = priceId ? tierForPriceId(priceId) : null;
      if (tier) {
        await grantCredits(userId, TIER_CREDITS[tier], "monthly_grant");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
