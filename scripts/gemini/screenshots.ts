import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Captures headless (Edge ou Chrome) pour la tâche `visual` : UI-4 × UI-3. */

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablette", width: 768, height: 1024 },
  { name: "ordinateur", width: 1440, height: 900 },
] as const;

// `preferredColorScheme` de Blink : 0 = sombre, 1 = clair. Un profil vierge n'a
// pas de thème mémorisé, donc l'application suit cette préférence.
const THEMES = [
  { name: "clair", blinkValue: 1 },
  { name: "sombre", blinkValue: 0 },
] as const;

const BROWSER_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/microsoft-edge",
];

function findBrowser(): string {
  const override = process.env.TYPIO_BROWSER;
  const found = override ? [override] : BROWSER_CANDIDATES.filter((candidate) => existsSync(candidate));
  if (found.length === 0) {
    throw new Error("Aucun navigateur headless trouvé. Définir TYPIO_BROWSER avec le chemin d'Edge ou de Chrome.");
  }
  return found[0];
}

// Edge et Chrome headless refusent une fenêtre plus étroite (492 px mesurés) : une
// fenêtre de 375 px rendrait en fait la page à 492 px, rognée. La page est donc
// affichée dans un cadre à la vraie largeur, sur un fond gris qui marque la marge.
const MIN_WINDOW_WIDTH = 520;
const FRAME_BACKGROUND = "#808080";

function writeFrame(outDir: string, url: string, viewport: (typeof VIEWPORTS)[number]): string {
  const file = path.join(outDir, "frames", `${slugFromUrl(url)}-${viewport.name}.html`);
  mkdirSync(path.dirname(file), { recursive: true });
  const src = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  writeFileSync(
    file,
    `<!doctype html><html><body style="margin:0;background:${FRAME_BACKGROUND}">` +
      `<iframe src="${src}" style="display:block;border:0;width:${viewport.width}px;height:${viewport.height}px"></iframe>` +
      `</body></html>`,
  );
  return file;
}

function slugFromUrl(url: string): string {
  const { pathname } = new URL(url);
  const slug = pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-");
  return slug || "accueil";
}

/** Capture chaque URL aux trois tailles et dans les deux thèmes ; renvoie les fichiers produits. */
export async function captureScreenshots(urls: readonly string[], outDir: string): Promise<string[]> {
  const browser = findBrowser();
  const files: string[] = [];

  for (const url of urls) {
    // Sans serveur, le navigateur capturerait sa propre page d'erreur.
    const reachable = await fetch(url, { signal: AbortSignal.timeout(15_000) }).then(
      () => true,
      () => false,
    );
    if (!reachable) {
      throw new Error(`${url} ne répond pas : lancer le serveur de développement avant la capture.`);
    }
    for (const viewport of VIEWPORTS) {
      const frame = writeFrame(outDir, url, viewport);
      for (const theme of THEMES) {
        const name = `${slugFromUrl(url)}-${viewport.name}-${theme.name}`;
        const file = path.join(outDir, `${name}.png`);
        const profile = path.join(outDir, "profiles", name);
        spawnSync(
          browser,
          [
            "--headless",
            "--disable-gpu",
            "--no-first-run",
            `--user-data-dir=${profile}`,
            `--window-size=${Math.max(viewport.width, MIN_WINDOW_WIDTH)},${viewport.height}`,
            // Laisse le temps à l'hydratation React avant la capture.
            "--virtual-time-budget=8000",
            `--blink-settings=preferredColorScheme=${theme.blinkValue}`,
            `--screenshot=${file}`,
            pathToFileURL(frame).href,
          ],
          { stdio: "ignore", timeout: 60_000 },
        );
        // Un profil navigateur pèse plusieurs dizaines de Mo : seule l'image compte.
        rmSync(profile, { recursive: true, force: true });
        if (!existsSync(file)) {
          throw new Error(`Capture impossible : ${url} (${viewport.name}, ${theme.name}).`);
        }
        files.push(file);
      }
    }
  }
  rmSync(path.join(outDir, "profiles"), { recursive: true, force: true });
  rmSync(path.join(outDir, "frames"), { recursive: true, force: true });
  return files;
}
