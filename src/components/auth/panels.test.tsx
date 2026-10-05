import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { MascotIllustration } from "./MascotIllustration";
import { ProgressIsland } from "./ProgressIsland";
import { PromisePanel } from "./PromisePanel";

describe("MascotIllustration", () => {
  it.each(["fr", "en"] as const)("est décorative : tout est aria-hidden, image à alt vide, textes traduits (%s)", (locale) => {
    const { illustration } = getDictionary(locale);
    const { container } = render(<MascotIllustration labels={illustration} />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image?.getAttribute("src")).toContain("mascotte-poulpe");
    expect(container).toHaveTextContent(illustration.praise);
    expect(container).toHaveTextContent(illustration.spaceKey);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("pose les touches A et Z avec une rotation, comme la maquette", () => {
    render(<MascotIllustration labels={getDictionary("fr").illustration} />);

    const keyA = screen.getByText("A", { selector: "div" });
    const keyZ = screen.getByText("Z", { selector: "div" });
    expect(keyA.style.transform).toContain("rotate(-8deg)");
    expect(keyZ.style.transform).toContain("rotate(12deg)");
    expect(keyA).toHaveClass("bg-key-yellow");
    expect(keyZ).toHaveClass("bg-key-mint");
  });
});

describe("ProgressIsland", () => {
  it.each(["fr", "en"] as const)("garde les textes lisibles et ne contient aucune image (%s)", (locale) => {
    const { island } = getDictionary(locale);
    const { container } = render(<ProgressIsland labels={island} />);

    for (const text of [island.zoneTitle, island.zoneText, island.progressTitle, island.progressText, island.perDay, island.rewards]) {
      expect(screen.getByText(text)).toBeVisible();
    }
    expect(container.querySelector("img")).toBeNull();
  });

  it("marque les icônes et le chemin en étapes comme décoratifs", () => {
    const { container } = render(<ProgressIsland labels={getDictionary("fr").island} />);

    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.closest('[aria-hidden="true"]') ?? svg).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByText("1").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("utilise les tokens de l'île (sable et menthe)", () => {
    const { container } = render(<ProgressIsland labels={getDictionary("fr").island} />);
    expect(container.querySelector(".bg-island-sand")).not.toBeNull();
    expect(container.querySelector(".bg-island-mint")).not.toBeNull();
  });
});

describe("PromisePanel", () => {
  it.each(["fr", "en"] as const)("affiche badge, titre sur deux lignes, conseil et trois bénéfices (%s)", (locale) => {
    const { promise } = getDictionary(locale);
    render(
      <PromisePanel labels={promise}>
        <p>illustration</p>
      </PromisePanel>,
    );

    expect(screen.getByText(promise.badge)).toHaveClass("uppercase");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(`${promise.titleLine1}${promise.titleLine2}`);
    expect(screen.getByText(promise.titleLine2)).toHaveClass("text-accent-text");
    expect(screen.getByText(promise.description)).toBeInTheDocument();
    expect(screen.getByText(promise.tipTitle)).toBeInTheDocument();
    expect(screen.getByText(promise.tipText)).toBeInTheDocument();
    for (const benefit of Object.values(promise.benefits)) expect(screen.getByText(benefit)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("rend l'illustration fournie à son emplacement", () => {
    render(
      <PromisePanel labels={getDictionary("fr").promise}>
        <p>illustration</p>
      </PromisePanel>,
    );
    expect(screen.getByText("illustration")).toBeInTheDocument();
  });
});
