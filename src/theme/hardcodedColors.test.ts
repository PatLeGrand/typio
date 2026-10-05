import { describe, expect, it } from "vitest";
import { findHardcodedColors } from "./hardcodedColors";

describe("findHardcodedColors", () => {
  it.each([
    ["hex", 'className="bg-[#fff]"'],
    ["hex long", 'const c = "#7043d9";'],
    ["rgb", "box-shadow: rgb(0 0 0)"],
    ["rgba", "color: rgba(0,0,0,.5)"],
    ["hsl", "hsl(10 20% 30%)"],
    ["oklch", "oklch(0.5 0.1 200)"],
    ["oklab", "oklab(0.5 0.1 0.1)"],
    ["color-mix", "color-mix(in srgb, red, blue)"],
    ["bg-white", 'className="bg-white p-4"'],
    ["text-black", 'className="text-black"'],
    ["border-white avec opacité", 'className="border-white/10"'],
    ["variante dark", 'className="dark:bg-black"'],
    ["palette", 'className="text-red-500"'],
    ["palette 2 chiffres", 'className="bg-slate-50"'],
    ["palette indigo", 'className="border-indigo-600"'],
    ["arbitraire hex", 'className="text-[#123456]"'],
    ["arbitraire rgb", 'className="bg-[rgb(1,2,3)]"'],
    ["arbitraire color:", 'className="text-[color:var(--x)]"'],
    ["arbitraire nommée", 'className="bg-[red]"'],
    ["arbitraire white", 'className="fill-[white]"'],
  ])("détecte : %s", (_name, source) => {
    expect(findHardcodedColors(source)).not.toEqual([]);
  });

  it.each([
    ["tokens", 'className="bg-surface text-accent-text border-border"'],
    ["transparent", 'className="bg-transparent"'],
    ["currentColor", 'className="text-current" style={{ fill: "currentColor" }}'],
    ["ombre via token", 'className="shadow-[0_4px_0_var(--accent-shadow)]"'],
    ["tailles arbitraires", 'className="text-[15px] size-[18px] gap-[9px]"'],
    ["accent-color via token", 'className="accent-accent"'],
    ["classes sans rapport", 'className="white-space-normal red-flag"'],
    ["ancre sans couleur", 'href="#"'],
  ])("laisse passer : %s", (_name, source) => {
    expect(findHardcodedColors(source)).toEqual([]);
  });

  it("nomme la règle enfreinte", () => {
    expect(findHardcodedColors("bg-white")).toEqual(["bg-white (white/black Tailwind)"]);
  });
});
