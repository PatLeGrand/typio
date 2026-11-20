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
    <p className="text-center text-sm text-muted">
      {prompt}{" "}
      <Link
        href={href}
        style={{ backgroundPositionY: "calc(50% + 0.7em)" }}
        className="road-link-inline inline-flex min-h-11 items-center rounded-field font-semibold text-accent-text"
      >
        {linkLabel}
      </Link>
    </p>
  );
}
