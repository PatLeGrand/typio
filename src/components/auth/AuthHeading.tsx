import { Sparkles } from "lucide-react";
import { Badge } from "../Badge";

type AuthHeadingProps = {
  /** Texte traduit du badge (affiché en majuscules). */
  kicker: string;
  /** Titre de la page : c'est le `h1`. */
  title: string;
  intro?: string;
};

/** Badge, titre et introduction en tête de chaque page d'authentification. */
export function AuthHeading({ kicker, title, intro }: AuthHeadingProps) {
  return (
    <div className="flex flex-col items-start gap-3.5">
      <Badge icon={<Sparkles />}>{kicker}</Badge>
      <h1 className="text-[32px] font-bold leading-[1.15] text-foreground sm:text-[38px]">{title}</h1>
      {intro && <p className="text-base leading-[1.55] text-muted">{intro}</p>}
    </div>
  );
}
