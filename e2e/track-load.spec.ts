import { expect, test, type Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import fr from "../src/i18n/dictionaries/fr.json";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "../src/race/config";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/realtime/protocol";
import { authFiles, createCredentials } from "./auth.helpers";

type RaceSnapshot = Parameters<ServerToClientEvents["race:state"]>[0];
type LoadClient = {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  race: RaceSnapshot | null;
  startedAt: number | null;
  sent: number;
  wpm: number;
};

test.use({ storageState: authFiles.memberA });

async function sampleFrames(page: Page, durationMs: number) {
  return page.evaluate((durationMs) => new Promise<number[]>((resolve) => {
    const intervals: number[] = [];
    let first: number | undefined;
    let previous: number | undefined;
    function sample(now: number) {
      first ??= now;
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      if (now - first >= durationMs) resolve(intervals);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }), durationMs);
}

test("la piste reste fluide avec 30 participants réels (PERF-03, PERF-02)", async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const clients: LoadClient[] = [];
  const errors: string[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    // Référence à trois coureurs dans le même contexte membre A, avant la salle.
    const solo = await page.context().newPage();
    let fpsSolo: number;
    try {
      await solo.goto(`/fr/race?${serializeRaceSettings(DEFAULT_RACE_SETTINGS)}`);
      await expect(solo.getByRole("heading", { name: fr.raceScreen.headline.racing, exact: true }))
        .toBeVisible({ timeout: 10_000 });
      const soloRunners = solo.getByRole("region", { name: fr.raceScreen.leaderboard, exact: true }).getByRole("listitem");
      await expect(soloRunners).toHaveCount(3);
      await expect(solo.locator("main canvas")).toBeVisible();
      await solo.locator("main canvas").scrollIntoViewIfNeeded();
      const frames = await sampleFrames(solo, 5_000);
      fpsSolo = frames.length * 1000 / frames.reduce((sum, interval) => sum + interval, 0);
      await solo.getByRole("button", { name: fr.room.leave, exact: true }).click();
      await expect(solo).toHaveURL("/fr/play");
    } finally {
      await solo.close();
    }

    // Même parcours et mêmes sélecteurs que room-race.spec.ts.
    await page.goto("/fr/race/settings");
    const settings = fr.raceSettings;
    const removeBot = page.getByRole("button", { name: settings.bots.remove.replace("{number}", "1"), exact: true });
    while (await removeBot.count()) await removeBot.click();
    await page.getByRole("radiogroup", { name: settings.textMode.label, exact: true })
      .getByRole("radio", { name: settings.textMode.words, exact: true }).click();
    await page.getByRole("radiogroup", { name: settings.complexity.label, exact: true })
      .getByRole("radio", { name: settings.complexity.easy }).click();
    await page.getByRole("radiogroup", { name: settings.accents.label, exact: true })
      .getByRole("radio", { name: settings.accents.exclude, exact: true }).click();
    await page.getByRole("combobox", { name: settings.length.label, exact: true }).selectOption("100");
    for (const option of ["punctuation", "numbers", "uppercase", "bonuses"] as const) {
      const toggle = page.getByRole("switch", { name: settings[option].label, exact: true });
      if (await toggle.getAttribute("aria-checked") === "true") await toggle.click();
    }
    await page.getByRole("combobox", { name: settings.capacity.label, exact: true }).selectOption("30");
    await page.getByRole("combobox", { name: settings.visibility.label, exact: true })
      .selectOption({ label: settings.visibility.code });
    await page.getByRole("button", { name: settings.invite.button, exact: true }).click();
    await expect(page.getByRole("heading", { name: fr.room.title, exact: true })).toBeVisible();
    const codeHeading = page.getByRole("heading", { name: fr.room.code.label, exact: true });
    const code = (await codeHeading.locator("..").getByRole("paragraph").first().innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // 29 créations < AUTH_RATE_LIMITS.guests (120/h/IP), sans contourner le serveur.
    for (let index = 0; index < 29; index++) {
      const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      let cookie: string;
      try {
        const guest = await context.newPage();
        await guest.goto("/fr/guest");
        await guest.getByLabel(fr.guest.pseudoLabel, { exact: true }).fill(`gst${createCredentials().username.slice(3)}`);
        await guest.getByRole("button", { name: fr.guest.submit, exact: true }).click();
        await expect(guest).toHaveURL("/fr");
        cookie = (await context.cookies(baseURL)).map(({ name, value }) => `${name}=${value}`).join("; ");
        expect(cookie).not.toBe("");
        await guest.close();
      } finally {
        await context.close();
      }

      const socket: LoadClient["socket"] = io("http://localhost:3101", {
        autoConnect: false,
        reconnection: false,
        transports: ["websocket"],
        extraHeaders: { Cookie: cookie, Origin: "http://localhost:3100" },
      });
      const client: LoadClient = { socket, race: null, startedAt: null, sent: 0, wpm: 40 + index * 40 / 28 };
      clients.push(client); // Le finally couvre aussi une connexion ou un join refusé.
      socket.on("room:error", (error) => errors.push(`${index}: ${error}`));
      socket.on("disconnect", (reason) => errors.push(`${index}: disconnected (${reason})`));
      socket.on("race:state", (race) => {
        client.race = race;
        if (race.status === "racing" && client.startedAt === null) client.startedAt = performance.now();
      });
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
        socket.connect();
      });
      // Un seul join réussi par invité : aucun échec consommant JOIN_FAILURE_LIMIT.
      const joined = await socket.timeout(10_000).emitWithAck("room:join", { code, role: "runner" });
      expect(joined).toEqual({ ok: true, data: { code } });
    }
    await expect(page.getByRole("list", { name: fr.room.participants.title, exact: true })
      .getByRole("listitem")).toHaveCount(30);

    // 5 caractères/mot : 40–80 MPM = 3,33–6,67 opérations/s.
    // Un lot/150 ms (< 10 messages/s), <= 64 opérations ; applyInput autorise 25/s + 15.
    timer = setInterval(() => {
      for (const client of clients) {
        if (client.race?.status !== "racing" || client.startedAt === null) continue;
        const target = Math.min(client.race.text.length,
          Math.floor((performance.now() - client.startedAt) / 1000 * client.wpm * 5 / 60));
        const ops = client.race.text.slice(client.sent, Math.min(target, client.sent + 64)).split("");
        if (ops.length === 0) continue;
        client.socket.emit("race:input", { ops });
        client.sent += ops.length;
      }
    }, 150);

    await page.getByRole("button", { name: fr.room.race.start, exact: true }).click();
    await expect(page.getByRole("heading", { name: fr.raceScreen.headline.racing, exact: true }))
      .toBeVisible({ timeout: 10_000 });
    const track = page.getByRole("region", { name: fr.raceScreen.leaderboard, exact: true });
    await expect(track.getByRole("listitem")).toHaveCount(30);
    const canvas = track.locator("canvas");
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();
    await expect.poll(() => clients.every((client) => client.race?.status === "racing" && client.sent > 0)).toBe(true);
    // Le plus rapide doit encore courir après 20 s, même sans l'hôte inactif.
    for (const client of clients) expect(client.race!.text.length / (client.wpm * 5 / 60)).toBeGreaterThan(20);

    const renderer = await canvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const debug = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "unknown";
    });
    const softwareRenderer = /SwiftShader|llvmpipe/i.test(renderer);
    // Ratio local : 0,56 avant l'optimisation, 0,73 à 0,75 après.
    const minimumFps = softwareRenderer ? 0.6 * fpsSolo : 50;
    const frames = await sampleFrames(page, 10_000);
    const sorted = [...frames].sort((a, b) => a - b);
    const fps = frames.length * 1000 / frames.reduce((sum, interval) => sum + interval, 0);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const ratio = fps / fpsSolo;
    const measurement = `[PERF-03] renderer=${renderer}, FPS solo=${fpsSolo.toFixed(1)}, FPS à 30=${fps.toFixed(1)}, ratio=${ratio.toFixed(3)}, seuil=${minimumFps.toFixed(1)} FPS (${softwareRenderer ? "0,6 × FPS solo" : "GPU matériel : 50 FPS"}), ${frames.length} frames : médiane=${median.toFixed(2)} ms, p95=${p95.toFixed(2)} ms`;
    console.log(measurement);
    test.info().annotations.push({ type: "PERF-03", description: measurement });
    await expect(canvas).toBeVisible();
    await expect(track.getByRole("listitem")).toHaveCount(30);
    for (const client of clients) {
      expect(client.socket.connected).toBe(true);
      expect(client.race?.status).toBe("racing");
      // L'hôte reste inactif ; les 29 invités doivent avancer côté serveur.
      expect(client.race?.runners.filter((runner) => runner.position > 0)).toHaveLength(29);
    }
    expect(errors).toEqual([]);
    expect(fps).toBeGreaterThanOrEqual(minimumFps);
  } finally {
    clearInterval(timer);
    for (const { socket } of clients) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    const leave = page.getByRole("button", { name: fr.room.leave, exact: true });
    if (await leave.isVisible()) await leave.click();
  }
});
