"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  tier,
  label,
  current,
}: {
  tier: "starter" | "pro" | "agency";
  label: string;
  current: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (body.url) window.location.href = body.url;
  }

  return (
    <Button
      onClick={checkout}
      disabled={loading || current}
      variant={current ? "secondary" : "default"}
      className="w-full"
    >
      {current ? "Current plan" : loading ? "Redirecting…" : label}
    </Button>
  );
}

export function PortalButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (body.url) window.location.href = body.url;
  }

  return (
    <Button variant="outline" onClick={openPortal} disabled={loading}>
      {loading ? "Opening…" : "Manage billing"}
    </Button>
  );
}
