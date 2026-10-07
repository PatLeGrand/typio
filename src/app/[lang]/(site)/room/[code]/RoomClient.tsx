"use client";

import { useEffect } from "react";
import { useRoom } from "@/realtime/useRoom";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Type, Users } from "lucide-react";
import { RadioCard } from "@/components/race/RadioCard";
import type { CurrentUser } from "@/auth/types";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RoomConfigPatch } from "@/realtime/protocol";

export function RoomClient({ code, lang, dict, user }: { code: string, lang: string, dict: Dictionary, user: CurrentUser }) {
  const room = useRoom();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleParam = searchParams.get("role") as "runner" | "spectator" | null;

  useEffect(() => {
    room.join({ code, role: roleParam || "runner" }).catch(() => {
      // ignore, error is captured in room.error
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const state = room.state;
  const isHost = state?.hostId === user.id;

  const handleUpdate = (patch: RoomConfigPatch) => {
    if (!isHost) return;
    room.updateConfig(patch);
  };

  const handleLeave = async () => {
    await room.leave();
    router.push(`/${lang}/play`);
  };

  if (room.error) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-surface border border-border rounded-2xl text-center">
        <h2 className="text-xl font-bold mb-4">Oups</h2>
        <p className="text-danger mb-8">{dict.room.errors[room.error] || room.error}</p>
        <Button onClick={() => router.push(`/${lang}/play`)}>Retour</Button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 text-center">
        <p className="text-muted">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-col sm:flex-row gap-4 items-start justify-between mb-8">
        <div>
          <h1 className="text-[40px] font-extrabold text-foreground leading-tight tracking-tight mb-2">
            {dict.room.title}
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <div className="px-6 py-3 bg-surface border border-border rounded-full font-mono text-2xl tracking-widest font-bold">
              {state.code}
            </div>
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(state.code)}>
              {dict.room.copyCode}
            </Button>
          </div>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={handleLeave}>
            {dict.room.leave}
          </Button>
          {isHost && (
            <Button>{dict.room.start}</Button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="min-w-0 w-full flex-1 flex flex-col gap-6">
          <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
            <div className="flex items-center gap-4 mb-6">
              <Type className="w-6 h-6 text-accent-text" />
              <h2 className="text-xl font-bold">{dict.raceSettings.textSection.title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className={!isHost ? "opacity-70 pointer-events-none" : ""}>
                <h3 className="text-[15px] font-semibold mb-3">{dict.raceSettings.textMode.label}</h3>
                <div className="flex gap-3">
                  <RadioCard
                    checked={state.config.textMode === "sentences"}
                    onChange={() => handleUpdate({ textMode: "sentences" })}
                    label={dict.raceSettings.textMode.sentences}
                  />
                  <RadioCard
                    checked={state.config.textMode === "words"}
                    onChange={() => handleUpdate({ textMode: "words" })}
                    label={dict.raceSettings.textMode.words}
                  />
                </div>
              </div>
              <div className={!isHost ? "opacity-70 pointer-events-none" : ""}>
                <h3 className="text-[15px] font-semibold mb-3">{dict.raceSettings.language.label}</h3>
                <div className="flex gap-3">
                  <RadioCard
                    checked={state.config.language === "fr"}
                    onChange={() => handleUpdate({ language: "fr" })}
                    label={dict.raceSettings.language.fr}
                  />
                  <RadioCard
                    checked={state.config.language === "en"}
                    onChange={() => handleUpdate({ language: "en" })}
                    label={dict.raceSettings.language.en}
                  />
                </div>
              </div>
              <div className={!isHost ? "opacity-70 pointer-events-none" : ""}>
                <h3 className="text-[15px] font-semibold mb-3">{dict.raceSettings.length.label}</h3>
                <div className="flex gap-3 flex-wrap">
                  <RadioCard checked={state.config.length === "short"} onChange={() => handleUpdate({ length: "short" })} label={dict.raceSettings.length.short} />
                  <RadioCard checked={state.config.length === "medium"} onChange={() => handleUpdate({ length: "medium" })} label={dict.raceSettings.length.medium} />
                  <RadioCard checked={state.config.length === "long"} onChange={() => handleUpdate({ length: "long" })} label={dict.raceSettings.length.long} />
                </div>
              </div>
              <div className={!isHost ? "opacity-70 pointer-events-none" : ""}>
                <h3 className="text-[15px] font-semibold mb-3">{dict.raceSettings.timeLimit.label}</h3>
                <div className="flex gap-3 flex-wrap">
                  <RadioCard checked={state.config.timeLimitSeconds === null} onChange={() => handleUpdate({ timeLimitSeconds: null })} label={dict.raceSettings.timeLimit.off} />
                  <RadioCard checked={state.config.timeLimitSeconds === 60} onChange={() => handleUpdate({ timeLimitSeconds: 60 })} label={`60 ${dict.raceSettings.timeLimit.seconds}`} />
                  <RadioCard checked={state.config.timeLimitSeconds === 120} onChange={() => handleUpdate({ timeLimitSeconds: 120 })} label={`120 ${dict.raceSettings.timeLimit.seconds}`} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="w-full lg:w-[380px] shrink-0">
          <div className="bg-surface border border-border rounded-[24px] p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-accent-text" />
              <h3 className="text-lg font-bold">{dict.room.participants} ({state.participants.length}/{state.maxRunners})</h3>
            </div>
            
            <ul className="flex flex-col gap-2">
              {state.participants.map((p) => (
                <li key={p.userId} className={`flex items-center justify-between p-3 rounded-lg border ${p.userId === user.id ? 'border-accent-text bg-accent-soft' : 'border-border bg-background'}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{p.displayName}</span>
                    {p.userId === state.hostId && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-island-mint bg-island-mint/10 px-2 py-0.5 rounded-full">
                        {dict.room.host}
                      </span>
                    )}
                    {p.role === "spectator" && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted bg-muted/10 px-2 py-0.5 rounded-full">
                        {dict.room.spectator}
                      </span>
                    )}
                  </div>
                  {!p.connected && (
                    <span className="text-xs text-danger">{dict.room.disconnected}</span>
                  )}
                </li>
              ))}
            </ul>

            {isHost && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
                <p className="text-sm font-semibold">{dict.room.addPlayer}</p>
                <div className="flex gap-2">
                  <input type="text" placeholder={dict.room.playerNametag} className="flex-1 h-10 px-3 rounded-field border border-border bg-background text-sm" />
                  <Button variant="secondary" className="h-10 px-4">{dict.room.add}</Button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
