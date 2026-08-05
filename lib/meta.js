// Meta Marketing API client: campaign performance + daily insights.
// Falls back to realistic demo data when META_ACCESS_TOKEN is not configured,
// so the dashboard works out of the box.

const GRAPH = () =>
  `https://graph.facebook.com/${process.env.META_API_VERSION || "v21.0"}`;

export function metaConfigured() {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH()}/${path}`);
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok || body.error) {
    const msg = body.error?.message || `Meta API error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return body;
}

function parseRoas(row) {
  // purchase_roas is an action-values array like [{action_type, value}]
  const entry = (row.purchase_roas || []).find((a) =>
    a.action_type.includes("purchase")
  );
  return entry ? Number(entry.value) : null;
}

export async function getOverview(datePreset = "last_30d") {
  if (!metaConfigured()) return demoOverview(datePreset);

  const account = `act_${process.env.META_AD_ACCOUNT_ID}`;
  const fields = "spend,impressions,clicks,ctr,cpm,cpc,purchase_roas";

  const [daily, campaigns] = await Promise.all([
    graphGet(`${account}/insights`, {
      fields,
      date_preset: datePreset,
      time_increment: "1",
      limit: "500",
    }),
    graphGet(`${account}/insights`, {
      fields: `campaign_name,${fields}`,
      date_preset: datePreset,
      level: "campaign",
      limit: "100",
    }),
  ]);

  return {
    demo: false,
    datePreset,
    daily: (daily.data || []).map((d) => ({
      date: d.date_start,
      spend: Number(d.spend || 0),
      impressions: Number(d.impressions || 0),
      clicks: Number(d.clicks || 0),
      ctr: Number(d.ctr || 0),
      cpm: Number(d.cpm || 0),
      roas: parseRoas(d),
    })),
    campaigns: (campaigns.data || []).map((c) => ({
      name: c.campaign_name,
      spend: Number(c.spend || 0),
      impressions: Number(c.impressions || 0),
      clicks: Number(c.clicks || 0),
      ctr: Number(c.ctr || 0),
      cpm: Number(c.cpm || 0),
      roas: parseRoas(c),
    })),
  };
}

// ---------- demo data ----------

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function demoOverview(datePreset) {
  const days = { last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 }[datePreset] || 30;
  const rand = seededRandom(42);
  const daily = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - 1);
    const weekend = [0, 6].includes(d.getDay()) ? 0.8 : 1;
    const trend = 1 + (days - i) / days / 6; // gentle upward trend
    const spend = +(180 * weekend * trend * (0.85 + rand() * 0.3)).toFixed(2);
    const impressions = Math.round(spend * (80 + rand() * 40)); // CPM ≈ $8–12
    const clicks = Math.round(impressions * (0.012 + rand() * 0.008));
    daily.push({
      date: d.toISOString().slice(0, 10),
      spend,
      impressions,
      clicks,
      ctr: +((clicks / impressions) * 100).toFixed(3),
      cpm: +((spend / impressions) * 1000).toFixed(2),
      roas: +(2.1 + rand() * 1.8).toFixed(2),
    });
  }

  const campaignNames = [
    "Prospecting — Broad",
    "Prospecting — Lookalike 1%",
    "Retargeting — 30d Visitors",
    "Retargeting — Cart Abandoners",
    "Catalog Sales — DPA",
  ];
  const campaigns = campaignNames.map((name, idx) => {
    const share = [0.32, 0.24, 0.18, 0.14, 0.12][idx];
    const spend = +(daily.reduce((s, d) => s + d.spend, 0) * share).toFixed(2);
    const impressions = Math.round(spend * (75 + rand() * 45));
    const clicks = Math.round(impressions * (0.01 + rand() * 0.012));
    return {
      name,
      spend,
      impressions,
      clicks,
      ctr: +((clicks / impressions) * 100).toFixed(3),
      cpm: +((spend / impressions) * 1000).toFixed(2),
      roas: +([2.3, 2.8, 4.6, 5.2, 3.4][idx] * (0.9 + rand() * 0.2)).toFixed(2),
    };
  });

  return { demo: true, datePreset, daily, campaigns };
}
