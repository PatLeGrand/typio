import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscordIcon } from "./DiscordIcon";

describe("DiscordIcon", () => {
  it("draws the Simple Icons Discord path inline, monochrome, 20 px, decorative", () => {
    const { container } = render(<DiscordIcon />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "currentColor");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    const path = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(path.startsWith("M20.317 4.3698a19.7913 19.7913")).toBe(true);
    expect(path.endsWith("2.4189-2.1568 2.4189Z")).toBe(true);
    expect(path.length).toBeGreaterThan(1200);
  });

  it("uses a single path with no hard-coded colour", () => {
    const { container } = render(<DiscordIcon />);

    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
  });

  it("forwards attributes such as a class or a size", () => {
    const { container } = render(<DiscordIcon className="size-5" width={32} />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveClass("size-5");
    expect(svg).toHaveAttribute("width", "32");
  });
});
