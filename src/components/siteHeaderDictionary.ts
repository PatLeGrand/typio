import type { Dictionary } from "@/i18n/dictionaries";

/** Libellés réellement lus par `SiteHeader` et `ProfileModal` : seuls ces champs traversent la frontière client. */
export type SiteHeaderDictionary = {
  site: Pick<Dictionary["site"], "name">;
  navigation: Pick<Dictionary["navigation"], "main">;
  home: { navigation: Dictionary["home"]["navigation"] };
  language: Dictionary["language"];
  theme: Dictionary["theme"];
  header: Dictionary["header"];
  profileDropdown: Dictionary["profileDropdown"];
  profile: { stats: Dictionary["profile"]["stats"] };
  history: Pick<Dictionary["history"], "title">;
};

export function pickSiteHeaderDictionary(dictionary: Dictionary): SiteHeaderDictionary {
  return {
    site: { name: dictionary.site.name },
    navigation: { main: dictionary.navigation.main },
    home: { navigation: dictionary.home.navigation },
    language: dictionary.language,
    theme: dictionary.theme,
    header: dictionary.header,
    profileDropdown: dictionary.profileDropdown,
    profile: { stats: dictionary.profile.stats },
    history: { title: dictionary.history.title },
  };
}
