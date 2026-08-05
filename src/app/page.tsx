import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Sparkles, Clapperboard } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Spy on winning ads",
    body: "Paste a Meta Ad Library URL or a competitor name and we pull the creative, copy and metadata straight into your swipe file.",
  },
  {
    icon: Sparkles,
    title: "AI Script Studio",
    body: "GPT-4o analyzes the original transcript and writes 3 fresh script variations engineered for Meta placements.",
  },
  {
    icon: Clapperboard,
    title: "Render on autopilot",
    body: "Pick a script, choose an AI voiceover, drop in your footage — we render finished video ads programmatically.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-bold tracking-tight">AdVault Studio</span>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button>Start free</Button>
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center py-24 text-center">
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Turn your competitors&apos; best ads into your next winners
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600">
          Scrape winning Meta ads, rewrite them with AI, and render new video
          variations — all in one workflow built for performance marketers.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/signup">
            <Button size="lg">Get started — 10 free credits</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-6 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent className="pt-6">
              <f.icon className="h-8 w-8 text-zinc-900" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
