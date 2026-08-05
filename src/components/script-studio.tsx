"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clapperboard, Save } from "lucide-react";
import type { GeneratedScript, SavedAd } from "@/lib/types";

const ANGLES = [
  "Direct response (problem → agitate → solve)",
  "UGC testimonial style",
  "Founder story / behind the brand",
  "Educational hook (did-you-know)",
];

export function ScriptStudio({
  ad,
  initialScripts,
}: {
  ad: SavedAd;
  initialScripts: GeneratedScript[];
}) {
  const [scripts, setScripts] = useState<GeneratedScript[]>(initialScripts);
  const [angle, setAngle] = useState(ANGLES[0]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setGenerating(true);
    const res = await fetch("/api/scripts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ savedAdId: ad.id, angle }),
    });
    setGenerating(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Generation failed.");
      return;
    }
    setScripts((prev) => [...(body.scripts as GeneratedScript[]), ...prev]);
  }

  async function saveEdit(script: GeneratedScript) {
    const content = edited[script.id];
    if (content === undefined || content === script.content) return;
    setSavingId(script.id);
    await fetch(`/api/scripts/${script.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSavingId(null);
    setScripts((prev) =>
      prev.map((s) =>
        s.id === script.id ? { ...s, content, is_edited: true } : s
      )
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: original ad */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Original ad</CardTitle>
          <CardDescription>
            {ad.meta_page_name ?? "Unknown advertiser"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {ad.ad_copy && (
            <div>
              <h4 className="mb-1 text-sm font-semibold">Ad copy</h4>
              <p className="whitespace-pre-wrap text-sm text-zinc-600">
                {ad.ad_copy}
              </p>
            </div>
          )}
          <div>
            <h4 className="mb-1 text-sm font-semibold">Transcript</h4>
            {ad.transcript ? (
              <p className="whitespace-pre-wrap text-sm text-zinc-600">
                {ad.transcript}
              </p>
            ) : (
              <p className="text-sm italic text-zinc-400">
                No transcript yet — transcription runs automatically for video
                ads after scraping.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right: generator + variations */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Generate scripts
            </CardTitle>
            <CardDescription>
              GPT-4o writes 3 fresh variations based on the original. Costs 1
              credit.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="angle">Creative angle</Label>
              <Select
                id="angle"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
              >
                {ANGLES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate 3 variations"}
            </Button>
          </CardContent>
        </Card>

        {scripts.map((script) => (
          <Card key={script.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {script.title ?? `Variation ${script.variation_number}`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {script.is_edited && (
                    <Badge variant="secondary">Edited</Badge>
                  )}
                  <Link href={`/renders/new?script=${script.id}`}>
                    <Button size="sm" variant="outline">
                      <Clapperboard className="h-3.5 w-3.5" /> Render
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Textarea
                rows={8}
                defaultValue={script.content}
                onChange={(e) =>
                  setEdited((prev) => ({ ...prev, [script.id]: e.target.value }))
                }
              />
              <Button
                size="sm"
                variant="ghost"
                className="self-end"
                disabled={
                  savingId === script.id ||
                  edited[script.id] === undefined ||
                  edited[script.id] === script.content
                }
                onClick={() => saveEdit(script)}
              >
                <Save className="h-3.5 w-3.5" />
                {savingId === script.id ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
