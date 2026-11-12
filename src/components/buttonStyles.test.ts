import { describe, expect, it } from "vitest";
import { buttonClasses, type ButtonVariant } from "./buttonStyles";

describe("buttonClasses : survol", () => {
  it.each(["primary", "secondary", "ghost", "key", "start"] as const satisfies readonly ButtonVariant[])(
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

  it.each(["primary", "secondary", "ghost", "key", "start"] as const)("%s : garde un style désactivé distinct", (variant) => {
    expect(buttonClasses(variant, false, "")).toMatch(/disabled:text-/);
  });

  it.each(["primary", "key", "start"] as const)("%s : aria-disabled neutralise le relief et les déplacements même sans disabled", (variant) => {
    const classes = buttonClasses(variant, false, "").split(" ");
    for (const state of ["", "hover:", "active:"]) {
      expect(classes).toContain(`aria-disabled:${state}shadow-none`);
      expect(classes).toContain(`aria-disabled:${state}translate-y-0`);
    }
    expect(classes).toContain("after:pointer-events-none");
    expect(classes).toContain("not-disabled:not-aria-disabled:active:after:pointer-events-auto");
  });

  it("start : réserve le décor sans figer la hauteur ni empêcher les retours à la ligne", () => {
    const classes = buttonClasses("start", false, "", true).split(" ");
    expect(classes).toEqual(expect.arrayContaining([
      "rounded-full", "border-2", "border-border", "bg-surface", "text-accent-text", "font-bold",
      "min-h-14", "min-w-0", "max-w-full", "text-center", "pl-14", "pr-[68px]", "sm:pl-[72px]", "sm:pr-[84px]",
      "not-disabled:shadow-[0_6px_0_var(--accent-shadow)]",
      "not-disabled:hover:shadow-[0_8px_0_var(--accent-shadow)]",
      "not-disabled:focus-visible:shadow-[0_6px_0_var(--accent-shadow)]",
      "not-disabled:active:shadow-[0_1px_0_var(--accent-shadow)]",
      "not-disabled:active:translate-y-[4px]", "motion-reduce:transition-none",
      "aria-disabled:focus-visible:shadow-none", "aria-disabled:focus-visible:translate-y-0",
    ]));
    for (const state of ["hover", "focus-visible", "active"]) {
      expect(classes).toContain(`motion-reduce:not-disabled:${state}:translate-y-0`);
    }
    for (const name of ["button-outline", "rounded-field", "whitespace-nowrap", "px-6"]) {
      expect(classes).not.toContain(name);
    }
    expect(classes.some((name) => /^h-\d/.test(name))).toBe(false);
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
