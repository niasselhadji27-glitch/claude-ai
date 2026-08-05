// Meta Ads Studio frontend: tabs, dashboard charts (vanilla SVG), creative
// generation, and trending ads browsing.

const $ = (sel) => document.querySelector(sel);
const tooltip = $("#tooltip");

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`#tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- status badges ----------
async function loadStatus() {
  const s = await fetch("/api/status").then((r) => r.json());
  $("#status-badges").innerHTML = [
    ["Meta API", s.meta],
    ["Claude", s.claude],
    ["Replicate", s.replicate],
  ]
    .map(([name, on]) => `<span class="badge ${on ? "on" : ""}">${name} ${on ? "✓" : "· demo/off"}</span>`)
    .join("");
}

// ---------- formatting ----------
const fmtMoney = (v) => "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const fmtNum = (v) => v.toLocaleString();
const fmtPct = (v) => v.toFixed(2) + "%";

// ---------- tooltip ----------
function showTooltip(evt, title, value) {
  tooltip.innerHTML = `<div class="tt-title">${title}</div><div class="tt-value">${value}</div>`;
  tooltip.hidden = false;
  const pad = 12;
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  const r = tooltip.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}
function hideTooltip() {
  tooltip.hidden = true;
}

// ---------- SVG helpers ----------
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Single-series line chart with hairline grid, 2px line, hover dot + tooltip.
function lineChart(container, points, { format, label }) {
  container.innerHTML = "";
  const W = 600, H = 220, m = { t: 12, r: 12, b: 26, l: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label });

  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const x = (i) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;

  // grid + y labels (4 steps)
  for (let g = 0; g <= 4; g++) {
    const gy = m.t + (ih * g) / 4;
    const cls = g === 4 ? "baseline" : "gridline";
    svg.appendChild(svgEl("line", { x1: m.l, x2: W - m.r, y1: gy, y2: gy, class: cls }));
    const val = max * (1 - g / 4);
    const t = svgEl("text", { x: m.l - 8, y: gy + 4, "text-anchor": "end" });
    t.textContent = format(val).replace(/\.00$/, "");
    svg.appendChild(t);
  }

  // sparse x labels (~5)
  const stride = Math.max(1, Math.round(points.length / 5));
  points.forEach((p, i) => {
    if (i % stride !== 0 && i !== points.length - 1) return;
    const t = svgEl("text", { x: x(i), y: H - 8, "text-anchor": "middle" });
    t.textContent = p.date.slice(5); // MM-DD
    svg.appendChild(t);
  });

  // line
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  svg.appendChild(svgEl("path", { d, class: "series-line" }));

  // hover layer: one hit column per point
  const dot = svgEl("circle", { r: 4.5, class: "hover-dot", visibility: "hidden" });
  svg.appendChild(dot);
  const colW = iw / points.length;
  points.forEach((p, i) => {
    const hit = svgEl("rect", {
      x: x(i) - colW / 2, y: m.t, width: colW, height: ih, class: "hit",
    });
    hit.addEventListener("mousemove", (e) => {
      dot.setAttribute("cx", x(i));
      dot.setAttribute("cy", y(p.value));
      dot.setAttribute("visibility", "visible");
      showTooltip(e, p.date, format(p.value));
    });
    hit.addEventListener("mouseleave", () => {
      dot.setAttribute("visibility", "hidden");
      hideTooltip();
    });
    svg.appendChild(hit);
  });

  container.appendChild(svg);
}

// Horizontal bar chart: rounded value-end, baseline-anchored, direct labels.
function barChart(container, rows, { format, label }) {
  container.innerHTML = "";
  const W = 900, rowH = 40, m = { t: 6, r: 70, b: 6, l: 230 };
  const H = m.t + m.b + rows.length * rowH;
  const iw = W - m.l - m.r;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label });
  const max = niceMax(Math.max(...rows.map((r) => r.value)));

  svg.appendChild(svgEl("line", { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: "baseline" }));

  rows.forEach((r, i) => {
    const cy = m.t + i * rowH + rowH / 2;
    const w = Math.max(4, (r.value / max) * iw);
    const barH = 14;
    // Rounded only on the value end: rect path with 4px radius on the right.
    const rad = 4;
    const path = `M${m.l},${cy - barH / 2} h${w - rad} a${rad},${rad} 0 0 1 ${rad},${rad} v${barH - 2 * rad} a${rad},${rad} 0 0 1 -${rad},${rad} h-${w - rad} z`;
    const bar = svgEl("path", { d: path, class: "bar" });
    bar.addEventListener("mousemove", (e) => showTooltip(e, r.name, format(r.value)));
    bar.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(bar);

    const name = svgEl("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end" });
    name.textContent = r.name.length > 30 ? r.name.slice(0, 29) + "…" : r.name;
    svg.appendChild(name);

    const val = svgEl("text", { x: m.l + w + 8, y: cy + 4, class: "bar-label" });
    val.textContent = format(r.value);
    svg.appendChild(val);
  });

  container.appendChild(svg);
}

// ---------- dashboard ----------
async function loadDashboard() {
  const range = $("#range").value;
  const data = await fetch(`/api/insights?range=${range}`).then((r) => r.json());
  if (data.error) {
    $("#demo-note").textContent = `Error: ${data.error}`;
    return;
  }
  $("#demo-note").textContent = data.demo
    ? "Demo data — set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in .env for live numbers"
    : "";

  const spend = data.daily.reduce((s, d) => s + d.spend, 0);
  const impressions = data.daily.reduce((s, d) => s + d.impressions, 0);
  const clicks = data.daily.reduce((s, d) => s + d.clicks, 0);
  const roasVals = data.daily.map((d) => d.roas).filter((v) => v != null);
  const avgRoas = roasVals.length ? roasVals.reduce((s, v) => s + v, 0) / roasVals.length : null;

  $("#stat-tiles").innerHTML = [
    ["Spend", fmtMoney(spend)],
    ["Impressions", fmtNum(impressions)],
    ["Clicks", fmtNum(clicks)],
    ["CTR", impressions ? fmtPct((clicks / impressions) * 100) : "—"],
    ["Avg ROAS", avgRoas != null ? avgRoas.toFixed(2) + "×" : "—"],
  ]
    .map(
      ([label, value]) =>
        `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div></div>`
    )
    .join("");

  lineChart(
    $("#chart-spend"),
    data.daily.map((d) => ({ date: d.date, value: d.spend })),
    { format: fmtMoney, label: "Daily ad spend" }
  );
  lineChart(
    $("#chart-ctr"),
    data.daily.map((d) => ({ date: d.date, value: d.ctr })),
    { format: (v) => v.toFixed(2), label: "Daily CTR percent" }
  );

  const campaigns = [...data.campaigns].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  barChart(
    $("#chart-roas"),
    campaigns.map((c) => ({ name: c.name, value: c.roas ?? 0 })),
    { format: (v) => v.toFixed(2) + "×", label: "ROAS by campaign" }
  );

  $("#campaign-table tbody").innerHTML = campaigns
    .map(
      (c) => `<tr>
        <td>${c.name}</td>
        <td>${fmtMoney(c.spend)}</td>
        <td>${fmtNum(c.impressions)}</td>
        <td>${fmtNum(c.clicks)}</td>
        <td>${fmtPct(c.ctr)}</td>
        <td>$${c.cpm.toFixed(2)}</td>
        <td>${c.roas != null ? c.roas.toFixed(2) + "×" : "—"}</td>
      </tr>`
    )
    .join("");
}
$("#range").addEventListener("change", loadDashboard);

// ---------- creative studio ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

$("#creative-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#cf-submit");
  btn.disabled = true;
  btn.textContent = "Generating…";
  $("#copy-results").innerHTML = "";
  try {
    const res = await fetch("/api/creative/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: $("#cf-product").value,
        audience: $("#cf-audience").value,
        tone: $("#cf-tone").value,
        offer: $("#cf-offer").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");

    $("#img-prompt").value = data.image_prompt;
    $("#vid-prompt").value = data.video_prompt;

    $("#copy-results").innerHTML =
      `<div class="card strategy-card"><h2>Strategy</h2><p>${esc(data.strategy)}</p></div>` +
      data.variants
        .map(
          (v, i) => `<div class="card copy-card">
            <span class="angle">${esc(v.angle)}</span>
            <h3>${esc(v.hook)}</h3>
            <p>${esc(v.primary_text)}</p>
            <div class="meta-line"><strong>Headline:</strong> ${esc(v.headline)}</div>
            <div class="meta-line"><strong>Description:</strong> ${esc(v.description)}</div>
            <div class="meta-line"><strong>CTA:</strong> ${esc(v.cta.replaceAll("_", " "))}</div>
            <button class="copy-btn" data-i="${i}">Copy text</button>
          </div>`
        )
        .join("");

    document.querySelectorAll(".copy-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const v = data.variants[b.dataset.i];
        navigator.clipboard.writeText(`${v.primary_text}\n\nHeadline: ${v.headline}\nDescription: ${v.description}`);
        b.textContent = "Copied ✓";
        setTimeout(() => (b.textContent = "Copy text"), 1500);
      })
    );
  } catch (err) {
    $("#copy-results").innerHTML = `<div class="card"><p class="error">⚠ ${esc(err.message)}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate ad copy + prompts";
  }
});

async function generateMedia(kind) {
  const isImage = kind === "image";
  const btn = isImage ? $("#btn-image") : $("#btn-video");
  const out = isImage ? $("#image-result") : $("#video-result");
  const prompt = (isImage ? $("#img-prompt") : $("#vid-prompt")).value.trim();
  if (!prompt) {
    out.innerHTML = `<p class="error">Write a prompt first (or generate one from the brief).</p>`;
    return;
  }
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Generating…";
  out.innerHTML = `<p class="muted small">Working — ${isImage ? "usually under a minute" : "this can take a few minutes"}…</p>`;
  try {
    const res = await fetch(`/api/creative/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isImage ? { prompt, aspectRatio: $("#img-aspect").value } : { prompt }
      ),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");
    out.innerHTML = isImage
      ? `<img src="${data.url}" alt="Generated ad image" /><p class="muted small"><a href="${data.url}" target="_blank" rel="noopener">Open full size</a></p>`
      : `<video src="${data.url}" controls></video><p class="muted small"><a href="${data.url}" target="_blank" rel="noopener">Download</a></p>`;
  } catch (err) {
    out.innerHTML = `<p class="error">⚠ ${esc(err.message)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
$("#btn-image").addEventListener("click", () => generateMedia("image"));
$("#btn-video").addEventListener("click", () => generateMedia("video"));

// ---------- trending ----------
async function loadTrending() {
  const q = $("#trend-query").value.trim();
  const country = $("#trend-country").value;
  $("#trending-grid").innerHTML = `<p class="muted">Searching…</p>`;
  try {
    const res = await fetch(`/api/trending?q=${encodeURIComponent(q)}&country=${country}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Search failed");
    $("#trend-note").textContent = data.demo
      ? "Demo examples — set META_ACCESS_TOKEN (with Ad Library access) for live results"
      : `${data.ads.length} active ads`;
    $("#trending-grid").innerHTML =
      data.ads
        .map(
          (ad) => `<div class="card ad-card">
            <div class="page-name">${esc(ad.page)}</div>
            ${ad.angle ? `<span class="angle-tag">${esc(ad.angle)}</span>` : ""}
            ${ad.title ? `<div class="meta-line"><strong>${esc(ad.title)}</strong></div>` : ""}
            <p>${esc(ad.body)}</p>
            ${ad.description ? `<div class="meta-line muted small">${esc(ad.description)}</div>` : ""}
            <div class="platforms">${(ad.platforms || []).map(esc).join(" · ")}
              · running since ${new Date(ad.startedAt).toLocaleDateString()}</div>
            ${ad.snapshotUrl ? `<a href="${ad.snapshotUrl}" target="_blank" rel="noopener">View in Ad Library →</a>` : ""}
          </div>`
        )
        .join("") || `<p class="muted">No ads found — try a broader keyword.</p>`;
  } catch (err) {
    $("#trending-grid").innerHTML = `<p class="error">⚠ ${esc(err.message)}</p>`;
  }
}
$("#btn-trend").addEventListener("click", loadTrending);
$("#trend-query").addEventListener("keydown", (e) => e.key === "Enter" && loadTrending());

// ---------- init ----------
loadStatus();
loadDashboard();
loadTrending();
