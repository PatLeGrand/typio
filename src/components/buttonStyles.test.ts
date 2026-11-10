import { describe, expect, it } from "vitest";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

describe("buttonClasses : survol", () => {
  it.each(["primary", "secondary", "ghost", "key"] as const satisfies readonly ButtonVariant[])(
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

  it.each(["primary", "secondary", "ghost", "key"] as const)("%s : garde un style désactivé distinct", (variant) => {
    expect(buttonClasses(variant, false, "")).toMatch(/disabled:text-/);
  });

  it.each(["primary", "key"] as const)("%s : réserve le relief et les déplacements aux touches actives", (variant) => {
    const classes = buttonClasses(variant, false, "").split(" ");
    expect(classes).toContain("not-disabled:hover:-translate-y-px");
    expect(classes).toContain("not-disabled:active:translate-y-[3px]");
    const shadows = classes.filter((name) => name.includes("shadow-["));
    expect(shadows).toHaveLength(3);
    expect(shadows.every((name) => name.startsWith("not-disabled:"))).toBe(true);
    for (const height of [4, 5, 1]) {
      expect(shadows.some((name) => name.includes(`shadow-[0_${height}px_0_`))).toBe(true);
    }
    expect(classes).toContain("transition-[transform,translate,box-shadow,background-color,color]");
    expect(classes).toContain("duration-100");
    expect(classes).toContain("motion-reduce:transition-none");
    expect(classes).toContain("motion-reduce:not-disabled:hover:translate-y-0");
    expect(classes).toContain("motion-reduce:not-disabled:active:translate-y-0");
    expect(classes).not.toContain("not-disabled:hover:opacity-90");
  });
});
