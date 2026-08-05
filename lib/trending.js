// Trending ad creatives via the Meta Ad Library API.
// Note: the Ad Library API returns all active ads for EU-targeted queries and
// political/issue ads elsewhere. Access requires identity verification at
// https://www.facebook.com/ads/library/api. Falls back to curated demo data.

const GRAPH = () =>
  `https://graph.facebook.com/${process.env.META_API_VERSION || "v21.0"}`;

export async function searchTrendingAds({ query, country = "US", limit = 12 }) {
  if (!process.env.META_ACCESS_TOKEN) return demoTrending(query);

  const url = new URL(`${GRAPH()}/ads_archive`);
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN);
  url.searchParams.set("search_terms", query || "");
  url.searchParams.set("ad_reached_countries", JSON.stringify([country]));
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "fields",
    [
      "id",
      "page_name",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_descriptions",
      "ad_delivery_start_time",
      "publisher_platforms",
      "ad_snapshot_url",
    ].join(",")
  );

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Ad Library error (HTTP ${res.status})`);
  }

  return {
    demo: false,
    ads: (body.data || []).map((ad) => ({
      id: ad.id,
      page: ad.page_name,
      body: ad.ad_creative_bodies?.[0] || "",
      title: ad.ad_creative_link_titles?.[0] || "",
      description: ad.ad_creative_link_descriptions?.[0] || "",
      startedAt: ad.ad_delivery_start_time,
      platforms: ad.publisher_platforms || [],
      snapshotUrl: ad.ad_snapshot_url,
    })),
  };
}

function demoTrending(query) {
  const topic = query || "your niche";
  const ads = [
    {
      page: "GlowSkin Co.",
      title: "The 60-second morning routine",
      body: `POV: you finally found a ${topic} product that actually works. 30-day money-back guarantee — nothing to lose.`,
      description: "Free shipping over $40",
      platforms: ["facebook", "instagram"],
      angle: "UGC / problem-solution hook",
    },
    {
      page: "PeakForm Fitness",
      title: "Why 40,000+ people switched",
      body: `We asked 500 customers why they left their old ${topic} brand. Their #1 answer surprised us…`,
      description: "See the results",
      platforms: ["instagram", "audience_network"],
      angle: "Curiosity gap + social proof",
    },
    {
      page: "Nomad Supply",
      title: "Rated 4.9/5 by 12,000 customers",
      body: `Stop overpaying for ${topic}. Same quality, half the price, delivered in 2 days.`,
      description: "Shop the drop",
      platforms: ["facebook", "instagram", "messenger"],
      angle: "Price anchor + urgency",
    },
    {
      page: "Bloom & Root",
      title: "Before / After — 2 weeks",
      body: `I was skeptical about ${topic} too. Then I tried it for 14 days. Swipe to see what happened →`,
      description: "Try it risk-free",
      platforms: ["instagram"],
      angle: "Transformation / testimonial",
    },
    {
      page: "Everyday Labs",
      title: "3 mistakes everyone makes",
      body: `You're probably making at least one of these ${topic} mistakes. #2 costs you the most.`,
      description: "Learn more",
      platforms: ["facebook", "instagram"],
      angle: "Educational listicle hook",
    },
    {
      page: "Coastal Goods",
      title: "This sold out 3 times",
      body: `Back in stock — the ${topic} essential everyone kept asking about. Limited run, again.`,
      description: "Get yours before it's gone",
      platforms: ["instagram", "facebook"],
      angle: "Scarcity + restock event",
    },
  ].map((ad, i) => ({
    id: `demo-${i}`,
    startedAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
    snapshotUrl: null,
    ...ad,
  }));

  return { demo: true, ads };
}
