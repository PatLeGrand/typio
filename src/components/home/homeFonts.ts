import { Big_Shoulders } from "next/font/google";

// Big Shoulders (OFL) : capitales étroites de signalétique de stade, pour les titres de l'accueil.
// Téléchargée au build comme Inter ; l'axe `opsz` resserre les grands corps.
export const displayFont = Big_Shoulders({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-big-shoulders",
});
