import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

export default async function RoomPage({ params }: { params: Promise<{ lang: string, code: string }> }) {
  const { code } = await params;

  // Mock participants
  const participants = [
    { id: 1, name: "Toi", role: "runner", isHost: true, isConnected: true },
    { id: 2, name: "Alex", role: "runner", isHost: false, isConnected: true },
    { id: 3, name: "Sam", role: "spectator", isHost: false, isConnected: false },
  ];

  return (
    <main className="flex-1 bg-surface px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1000px] flex flex-col gap-8 md:flex-row items-start">
        
        {/* Left column: Participants & Code */}
        <div className="flex-1 w-full flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Salle <span className="font-mono tracking-widest text-accent-text">{code.toUpperCase()}</span></h1>
            <Button disabled>Copier le code</Button>
          </div>

          <Card className="flex flex-col p-6 gap-4 border border-border">
            <h2 className="text-xl font-medium">Participants ({participants.length})</h2>
            <ul className="flex flex-col gap-3">
              {participants.map(p => (
                <li key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${!p.isConnected && "opacity-50"}`}>{p.name}</span>
                    {p.isHost && <Badge>Hôte</Badge>}
                    {p.role === "spectator" && <Badge>Spectateur</Badge>}
                    {!p.isConnected && <Badge tone="surface">Déconnecté</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          
          <Button variant="ghost" className="self-start text-muted hover:text-foreground">
            Quitter la salle
          </Button>
        </div>

        {/* Right column: Course settings */}
        <div className="w-full md:w-[400px]">
          <Card className="flex flex-col overflow-hidden border border-border">
            <div className="bg-accent-panel px-6 py-6 relative overflow-hidden h-32 flex items-start">
              <h2 className="text-2xl font-bold text-foreground relative z-10">Ta course, en bref</h2>
              {/* Mock blob visual */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-20 bg-accent rounded-t-full flex items-center justify-center gap-3 pb-4">
                 <div className="w-2.5 h-2.5 bg-surface rounded-full"></div>
                 <div className="w-2.5 h-2.5 bg-surface rounded-full"></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface/30 to-transparent pointer-events-none" />
            </div>
            
            <div className="p-6 flex flex-col gap-4 text-sm bg-surface">
              <div className="text-muted mb-2">Toi + 2 bots • 3 participants</div>
              
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Type de texte</span>
                <span className="font-semibold text-foreground">Phrases</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Langue</span>
                <span className="font-semibold text-foreground">Français</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Accents</span>
                <span className="font-semibold text-foreground">Inclus</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Longueur du texte</span>
                <span className="font-semibold text-foreground">Moyen</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Caractères exclus</span>
                <span className="font-semibold text-foreground">Aucun</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Limite de temps</span>
                <span className="font-semibold text-foreground">300 secondes</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Mode de saisie</span>
                <span className="font-semibold text-foreground">Libre</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Nombre de bots</span>
                <span className="font-semibold text-foreground">2 • Normale</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted">Capacités</span>
                <span className="font-semibold text-foreground">Désactivées</span>
              </div>

              <div className="mt-2 rounded-xl bg-accent-soft p-4 flex items-start gap-3 text-accent-text text-sm font-medium">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                <p>La vitesse, c&apos;est bien. La précision fait avancer ton Blob !</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
