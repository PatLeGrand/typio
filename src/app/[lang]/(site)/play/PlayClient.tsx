"use client";

import { useState } from "react";
import { useRoom } from "@/realtime/useRoom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function PlayClient({ action, lang, dict }: { action: "create" | "join", lang: string, dict: Record<string, any> }) {
  const room = useRoom();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"runner" | "spectator">("runner");

  const handleCreate = async () => {
    try {
      const res = await room.create();
      router.push(`/${lang}/room/${res.code}`);
    } catch (err) {
      // room.error holds the error
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    try {
      router.push(`/${lang}/room/${code.toUpperCase()}?role=${role}`);
    } catch (err) {
      // ...
    }
  };

  if (action === "create") {
    return (
      <div>
        <Button onClick={handleCreate} className="w-full text-[15px]">
          {dict.play.create.button}
        </Button>
        {room.error && <p className="mt-4 text-sm text-danger">{dict.errors[room.error] || room.error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-6">
      <div>
        <label htmlFor="room-code" className="block text-sm font-semibold mb-2">{dict.play.join.codeLabel}</label>
        <input
          id="room-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={dict.play.join.codePlaceholder}
          maxLength={6}
          className="w-full h-12 px-4 rounded-field border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent-text text-[15px] uppercase tracking-widest font-mono"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">{dict.play.join.roleLabel}</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={role === "runner"} onChange={() => setRole("runner")} className="accent-accent-text" />
            <span>{dict.play.join.runner}</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={role === "spectator"} onChange={() => setRole("spectator")} className="accent-accent-text" />
            <span>{dict.play.join.spectator}</span>
          </label>
        </div>
      </div>

      <Button type="submit" className="w-full text-[15px] mt-2">
        {dict.play.join.button}
      </Button>
    </form>
  );
}
