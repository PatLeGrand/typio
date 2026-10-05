import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GithubIcon } from "./GithubIcon";

describe("GithubIcon", () => {
  it("trace le logo avec la couleur du texte et reste décoratif", () => {
    const { container } = render(<GithubIcon />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("viewBox", "0 0 20 20");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("path")).toHaveAttribute("d", expect.stringContaining("M7.49949 18.334V15.0004"));
  });

  it("transmet les attributs fournis, par exemple une taille", () => {
    const { container } = render(<GithubIcon width={32} height={32} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "32");
  });
});
