"use server";

import { headers } from "next/headers";
import { createRateLimiter, getClientIp, ipRateLimitKey } from "@/auth/rateLimit";
import { z } from "zod";
import { raceSettingsSchema } from "@/race/config";
import { textCorpusRepository } from "@/race/drizzleTextCorpusRepository";
import { createRaceText } from "@/race/raceText";
import type { TextGenerationResult } from "@/race/textGenerator";

const textRequests = createRateLimiter({ limit: 30, windowMs: 60_000 });

const requestSchema = z.strictObject({
  settings: raceSettingsSchema,
  previous: z.string().max(1000).optional(),
});

/** Génération publique ; aucune identité ni donnée privée n'est lue ou modifiée. */
export async function nextRaceText(input: unknown): Promise<TextGenerationResult | { ok: false; error: "RATE_LIMITED" }> {
  if (!textRequests.consume(ipRateLimitKey(getClientIp(await headers())))) return { ok: false, error: "RATE_LIMITED" };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "NO_TEXT_AVAILABLE" };
  const { settings, previous } = parsed.data;
  const corpus = settings.textMode === "sentences" ? await textCorpusRepository.load() : undefined;
  const text = createRaceText(settings, Math.random, previous, corpus);
  return text === null ? { ok: false, error: "NO_TEXT_AVAILABLE" } : { ok: true, text };
}
