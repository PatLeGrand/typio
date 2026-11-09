/** Remplace les espaces insécables du dictionnaire français par des espaces simples, comme le fait le DOM normalisé des matchers de Testing Library. */
export function plain(text: string): string {
  return text.replaceAll(" ", " ");
}
