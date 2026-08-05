"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { Board } from "@/lib/types";

export function BoardFilter({ boards }: { boards: Board[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeBoard = searchParams.get("board");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function selectBoard(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("board", id);
    else params.delete("board");
    router.push(`/dashboard?${params.toString()}`);
  }

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setAdding(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => selectBoard(null)}
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium",
          !activeBoard
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-600 hover:bg-zinc-100"
        )}
      >
        All ads
      </button>
      {boards.map((b) => (
        <button
          key={b.id}
          onClick={() => selectBoard(b.id)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            activeBoard === b.id
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 hover:bg-zinc-100"
          )}
        >
          {b.name}
        </button>
      ))}
      {adding ? (
        <form onSubmit={createBoard} className="flex items-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Board name"
            className="h-8 w-40"
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "…" : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          <Plus className="h-3.5 w-3.5" /> New board
        </button>
      )}
    </div>
  );
}
