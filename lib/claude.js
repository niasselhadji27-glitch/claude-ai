// AI creative generation with Claude: ad copy variants, hooks, and prompts
// for the image/video generators — returned as validated JSON via structured outputs.

import Anthropic from "@anthropic-ai/sdk";

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const CREATIVE_SCHEMA = {
  type: "object",
  properties: {
    strategy: {
      type: "string",
      description: "2-3 sentence creative strategy for this product and audience",
    },
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string", description: "The persuasion angle, e.g. social proof, urgency, UGC" },
          hook: { type: "string", description: "Scroll-stopping first line" },
          primary_text: { type: "string", description: "Meta ad primary text, 2-4 short paragraphs with line breaks" },
          headline: { type: "string", description: "Max 40 characters" },
          description: { type: "string", description: "Link description, max 30 characters" },
          cta: {
            type: "string",
            enum: ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "GET_OFFER", "SUBSCRIBE", "CONTACT_US"],
          },
        },
        required: ["angle", "hook", "primary_text", "headline", "description", "cta"],
        additionalProperties: false,
      },
    },
    image_prompt: {
      type: "string",
      description:
        "A detailed text-to-image prompt for the ad visual: subject, setting, lighting, composition, style. No text overlays.",
    },
    video_prompt: {
      type: "string",
      description:
        "A detailed text-to-video prompt for a 5-10s ad clip: scene, camera movement, mood, pacing.",
    },
  },
  required: ["strategy", "variants", "image_prompt", "video_prompt"],
  additionalProperties: false,
};

export async function generateCreative({ product, audience, tone, offer, count = 3 }) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "You are a senior Meta ads creative strategist. You write high-converting, platform-native " +
      "ad copy that respects Meta's ad policies (no exaggerated claims, no before/after health claims, " +
      "no clickbait that misrepresents the product). Each variant must take a genuinely different " +
      "persuasion angle. Hooks must work in the first line of a feed post, before the 'See more' fold.",
    messages: [
      {
        role: "user",
        content:
          `Create ${count} Meta ad copy variants plus one image prompt and one video prompt.\n\n` +
          `Product/service: ${product}\n` +
          `Target audience: ${audience || "general consumers"}\n` +
          `Tone: ${tone || "confident, conversational"}\n` +
          `Offer/promo: ${offer || "none — focus on the product's core value"}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: CREATIVE_SCHEMA },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request. Try rephrasing the product description.");
  }

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response from Claude");
  return JSON.parse(text);
}
