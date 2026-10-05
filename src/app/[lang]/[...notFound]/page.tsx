import { notFound } from "next/navigation";

/** Les routes connues restent prioritaires ; toute autre adresse utilise la page 404 `[lang]`. */
export default function UnknownLocalizedRoute(): never {
  notFound();
}
