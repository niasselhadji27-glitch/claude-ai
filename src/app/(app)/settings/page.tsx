import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton, PortalButton } from "@/components/billing-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types";

const plans = [
  {
    tier: "starter" as const,
    name: "Starter",
    price: "$29/mo",
    credits: 100,
    blurb: "For solo media buyers testing new angles.",
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: "$79/mo",
    credits: 500,
    blurb: "For marketers shipping creatives weekly.",
  },
  {
    tier: "agency" as const,
    name: "Agency",
    price: "$199/mo",
    credits: 2000,
    blurb: "For teams managing multiple accounts.",
  },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  const tier = profile?.subscription_tier ?? "free";

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-zinc-500">Email:</span> {user.email}
          </p>
          <p className="flex items-center gap-2">
            <span className="text-zinc-500">Plan:</span>
            <Badge variant="secondary" className="capitalize">
              {tier}
            </Badge>
          </p>
          <p>
            <span className="text-zinc-500">Credits remaining:</span>{" "}
            {profile?.credits_balance ?? 0}
          </p>
          {profile?.stripe_customer_id && (
            <div className="mt-2">
              <PortalButton />
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold">Plans</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.tier}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.blurb}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-2xl font-bold">{plan.price}</p>
              <p className="text-sm text-zinc-500">
                {plan.credits} credits / month
              </p>
              <CheckoutButton
                tier={plan.tier}
                label={`Upgrade to ${plan.name}`}
                current={tier === plan.tier}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
