// Doublures pour les tests du flux OAuth : aucun réseau, aucun Arctic.
import { vi } from "vitest";
import type { OAuthProfile, OAuthProviderClient, OAuthProviderName } from "./providers";

/** Faux fournisseur : l'URL d'autorisation embarque le `state` et le défi PKCE reçus, pour les retrouver. */
export function createFakeProvider(
  name: OAuthProviderName,
  options: { accessToken?: string } = {},
): OAuthProviderClient & { exchangeCode: ReturnType<typeof vi.fn<OAuthProviderClient["exchangeCode"]>> } {
  const accessToken = options.accessToken ?? "access-token-xyz";
  return {
    name,
    usesPkce: name === "discord",
    createAuthorizationURL(state, codeVerifier) {
      const url = new URL(`https://${name}.example/authorize`);
      url.searchParams.set("state", state);
      if (codeVerifier !== null) url.searchParams.set("code_verifier_seen", codeVerifier);
      return url;
    },
    exchangeCode: vi.fn<OAuthProviderClient["exchangeCode"]>(async () => accessToken),
  };
}

export function profile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return { accountId: "583231", login: "octocat", ...overrides };
}
