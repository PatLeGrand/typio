import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'image Docker n'embarque que ce que l'application utilise vraiment :
  // Next recopie dans .next/standalone le serveur et les seules dépendances
  // atteignables depuis le code. Sans ça il faudrait expédier node_modules
  // en entier (plusieurs centaines de Mo) vers un VPS qui n'a que 1,9 Go de
  // RAM et 33 Go de disque partagés avec huit autres conteneurs.
  output: "standalone",
};

export default nextConfig;
