import Link from "next/link";

type AuthAltLinkProps = {
  /** Question traduite (« Déjà un compte ? »). */
  prompt: string;
  /** Texte traduit du lien (« Connecte-toi »). */
  linkLabel: string;
  href: string;
};

/** Ligne centrée « question + lien » sous un formulaire d'authentification. */
export function AuthAltLink({ prompt, linkLabel, href }: AuthAltLinkProps) {
  return (
    <p className="text-center text-[13px] text-muted">
      {prompt}{" "}
      <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline">
        {linkLabel}
      </Link>
    </p>
  );
}
