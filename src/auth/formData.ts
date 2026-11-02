import { z } from "zod";

/**
 * Lit les champs d'un `FormData` listés dans le schéma, puis les valide (TECH-07). Seules les
 * valeurs texte comptent (une valeur de formulaire peut être un fichier) ; les champs inconnus,
 * comme ceux que Next.js ajoute aux Server Actions, sont ignorés.
 */
export function readForm<Shape extends z.ZodRawShape>(
  formData: FormData,
  schema: z.ZodObject<Shape>,
): z.output<z.ZodObject<Shape>> {
  const fields: Record<string, string> = {};
  for (const name of Object.keys(schema.shape)) {
    const value = formData.get(name);
    if (typeof value === "string") fields[name] = value;
  }
  return schema.parse(fields);
}
