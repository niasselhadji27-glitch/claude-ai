import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getOverview, metaConfigured } from "./lib/meta.js";
import { searchTrendingAds } from "./lib/trending.js";
import { generateCreative, claudeConfigured } from "./lib/claude.js";
import { generateImage, generateVideo, replicateConfigured } from "./lib/media.js";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(here, "public")));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

// Which integrations are configured (the UI shows demo badges for the rest)
app.get("/api/status", (req, res) => {
  res.json({
    meta: metaConfigured(),
    claude: claudeConfigured(),
    replicate: replicateConfigured(),
  });
});

// Ads performance: daily series + per-campaign breakdown
app.get(
  "/api/insights",
  wrap(async (req, res) => {
    const datePreset = req.query.range || "last_30d";
    res.json(await getOverview(datePreset));
  })
);

// Trending ad creatives (Meta Ad Library)
app.get(
  "/api/trending",
  wrap(async (req, res) => {
    res.json(
      await searchTrendingAds({
        query: req.query.q || "",
        country: req.query.country || "US",
      })
    );
  })
);

// AI ad copy + creative concepts (Claude)
app.post(
  "/api/creative/copy",
  wrap(async (req, res) => {
    if (!claudeConfigured()) {
      return res.status(400).json({ error: "Set ANTHROPIC_API_KEY in .env to generate ad copy." });
    }
    const { product, audience, tone, offer } = req.body;
    if (!product) return res.status(400).json({ error: "product is required" });
    res.json(await generateCreative({ product, audience, tone, offer }));
  })
);

// AI image generation (Replicate)
app.post(
  "/api/creative/image",
  wrap(async (req, res) => {
    if (!replicateConfigured()) {
      return res.status(400).json({ error: "Set REPLICATE_API_TOKEN in .env to generate images." });
    }
    const { prompt, aspectRatio } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    res.json(await generateImage(prompt, { aspectRatio }));
  })
);

// AI video generation (Replicate)
app.post(
  "/api/creative/video",
  wrap(async (req, res) => {
    if (!replicateConfigured()) {
      return res.status(400).json({ error: "Set REPLICATE_API_TOKEN in .env to generate video." });
    }
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    res.json(await generateVideo(prompt));
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Meta Ads Studio running at http://localhost:${port}`);
  if (!metaConfigured()) console.log("  META_ACCESS_TOKEN not set — dashboard uses demo data");
  if (!claudeConfigured()) console.log("  ANTHROPIC_API_KEY not set — ad copy generation disabled");
  if (!replicateConfigured()) console.log("  REPLICATE_API_TOKEN not set — image/video generation disabled");
});
