import { describe, expect, it } from "vitest";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

describe("buttonClasses : survol", () => {
  it.each(["primary", "secondary", "ghost"] as const satisfies readonly ButtonVariant[])(
    "%s : le survol vise tout élément non désactivé, donc un lien comme un bouton",
    (variant) => {
      const classes = buttonClasses(variant, false, "").split(" ");

      // `:enabled` ne s'applique qu'aux éléments de formulaire : il rendait le survol des
      // liens-boutons (`<a>`) inopérant. `:not(:disabled)` les inclut et exclut le bouton désactivé.
      expect(classes.some((name) => name.startsWith("not-disabled:hover:"))).toBe(true);
      expect(classes.some((name) => name.startsWith("enabled:hover:"))).toBe(false);
      expect(classes.some((name) => name.startsWith("hover:"))).toBe(false);
    },
  );

  it.each(["primary", "secondary", "ghost"] as const)("%s : garde un style désactivé distinct", (variant) => {
    expect(buttonClasses(variant, false, "")).toMatch(/disabled:text-/);
  });
});
