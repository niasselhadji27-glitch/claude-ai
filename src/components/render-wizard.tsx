"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GeneratedScript, VoiceProfile } from "@/lib/types";

export function RenderWizard({
  scripts,
  voices,
  preselectedScriptId,
  userId,
}: {
  scripts: (GeneratedScript & { saved_ads: { meta_page_name: string | null } | null })[];
  voices: VoiceProfile[];
  preselectedScriptId: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [scriptId, setScriptId] = useState(
    preselectedScriptId ?? scripts[0]?.id ?? ""
  );
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "uploading" | "rendering">("idle");

  const selectedScript = scripts.find((s) => s.id === scriptId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let backgroundPath: string | null = null;

      if (file) {
        setStep("uploading");
        const supabase = createClient();
        const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("user-assets")
          .upload(path, file);
        if (uploadError) throw new Error(uploadError.message);
        backgroundPath = path;
      }

      setStep("rendering");
      const res = await fetch("/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId,
          voiceProfileId: voiceId || null,
          backgroundPath,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Render failed to start.");

      router.push("/renders");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
      setStep("idle");
    }
  }

  if (scripts.length === 0) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="pt-6 text-sm text-zinc-500">
          You haven&apos;t generated any scripts yet. Open an ad in your swipe
          file and use the Script Studio first.
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a script</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
            {scripts.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.saved_ads?.meta_page_name ?? "Ad") +
                  " — " +
                  (s.title ?? `Variation ${s.variation_number}`)}
              </option>
            ))}
          </Select>
          {selectedScript && (
            <p className="line-clamp-4 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
              {selectedScript.content}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Pick a voiceover</CardTitle>
          <CardDescription>AI voices powered by ElevenLabs.</CardDescription>
        </CardHeader>
        <CardContent>
          {voices.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No voice profiles configured yet — the render will use the
              platform default voice.
            </p>
          ) : (
            <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Background footage (optional)</CardTitle>
          <CardDescription>
            Upload a video or image to use behind the voiceover. Without one,
            the template&apos;s default background is used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label
            htmlFor="asset"
            className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-zinc-300 p-8 text-center hover:bg-zinc-50"
          >
            <span className="text-sm font-medium">
              {file ? file.name : "Click to choose a file"}
            </span>
            <span className="mt-1 text-xs text-zinc-400">
              MP4, MOV, PNG or JPG · max 200 MB
            </span>
          </Label>
          <input
            id="asset"
            type="file"
            accept="video/mp4,video/quicktime,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting || !scriptId}>
        {step === "uploading"
          ? "Uploading asset…"
          : step === "rendering"
            ? "Starting render…"
            : "Render video (5 credits)"}
      </Button>
    </form>
  );
}
