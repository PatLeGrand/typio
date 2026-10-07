"use client";

import { useState, useEffect } from "react";
import { RaceVisualizer, Racer } from "@/components/race/RaceVisualizer";

export default function SandboxRacePage() {
  const [racers, setRacers] = useState<Racer[]>([
    { id: "1", name: "Toi", progress: 0, isLocal: true },
    { id: "2", name: "Adversaire", progress: 0, isLocal: false },
  ]);

  // Simuler une course (pour tester les bonds)
  useEffect(() => {
    const interval = setInterval(() => {
      setRacers((prev) =>
        prev.map((racer) => {
          // L'adversaire avance de façon aléatoire et constante
          if (!racer.isLocal) {
            return { ...racer, progress: Math.min(100, racer.progress + Math.random() * 2) };
          }
          return racer;
        })
      );
    }, 400); // Mise à jour de l'adversaire

    return () => clearInterval(interval);
  }, []);

  // Le joueur local avance quand on tape n'importe quelle touche
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setRacers((prev) =>
        prev.map((racer) => {
          if (racer.isLocal) {
            // Avance de 0,4 % à chaque touche frappée (≈ 20 px sur 5000)
            return { ...racer, progress: Math.min(100, racer.progress + 0.4) };
          }
          return racer;
        })
      );
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-5xl space-y-6">
        <h1 className="text-center text-3xl font-black text-foreground">
          Test de la Course (Concept Blob)
        </h1>
        
        <p className="text-center text-muted">
          Tape n&apos;importe quoi sur ton clavier pour faire avancer ton Blob ! L&apos;adversaire avance tout seul.
        </p>

        {/* Composant PixiJS */}
        <RaceVisualizer racers={racers} trackLength={5000} />

        {/* Indicateurs React classiques (HUD) */}
        <div className="grid grid-cols-2 gap-4">
          {racers.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
              <span className="font-bold text-card-foreground">{r.name}</span>
              <span className="rounded bg-muted px-2 py-1 text-sm text-muted-foreground">
                {Math.round(r.progress)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
