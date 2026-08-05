// AI image + video generation via Replicate. Model slugs are configurable in
// .env so you can swap in any text-to-image / text-to-video model that accepts
// a "prompt" input (Flux, SDXL, Kling, Minimax, Wan, etc.).

const API = "https://api.replicate.com/v1";

export function replicateConfigured() {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

async function createPrediction(model, input) {
  const res = await fetch(`${API}/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({ input }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.detail || `Replicate error (HTTP ${res.status})`);
  }
  return pollUntilDone(body);
}

async function pollUntilDone(prediction, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  let current = prediction;
  while (["starting", "processing"].includes(current.status)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Generation timed out — try again or use a faster model");
    }
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(current.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    current = await res.json();
  }
  if (current.status !== "succeeded") {
    throw new Error(current.error || `Generation ${current.status}`);
  }
  const output = current.output;
  // Output can be a URL string or an array of URLs depending on the model.
  const url = Array.isArray(output) ? output[0] : output;
  return { url, model: current.model, predictionId: current.id };
}

export async function generateImage(prompt, { aspectRatio = "1:1" } = {}) {
  const model = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell";
  return createPrediction(model, { prompt, aspect_ratio: aspectRatio });
}

export async function generateVideo(prompt) {
  const model = process.env.REPLICATE_VIDEO_MODEL || "minimax/video-01";
  return createPrediction(model, { prompt });
}
