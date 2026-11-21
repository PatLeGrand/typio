import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_BLOB_STYLE, type BlobStyle } from "@/race/blobStyle";
import type { BlobStyleSaveResult } from "./blobStyleActions";

const mocks = vi.hoisted(() => ({
  updateBlobStyle: vi.fn<(formData: FormData) => Promise<BlobStyleSaveResult>>(),
}));

vi.mock("./blobStyleActions", () => mocks);

import { BlobCustomizer } from "./BlobCustomizer";
import { plain } from "@/test/text";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateBlobStyle.mockImplementation(async (formData) => ({
    ok: true,
    style: {
      color: formData.get("color") as BlobStyle["color"],
      expression: formData.get("expression") as BlobStyle["expression"],
      glasses: formData.get("glasses") as BlobStyle["glasses"],
      hat: formData.get("hat") as BlobStyle["hat"],
      accessory: formData.get("accessory") as BlobStyle["accessory"],
    },
  }));
});

describe.each(["fr", "en"] as const)("BlobCustomizer (%s)", (locale) => {
  const labels = getDictionary(locale).profile.blob;

  const setup = (initialStyle: BlobStyle = DEFAULT_BLOB_STYLE, isDemo = false) =>
    render(<BlobCustomizer initialStyle={initialStyle} isDemo={isDemo} labels={labels} />);

  it("affiche les cinq groupes accessibles, met à jour l'aperçu en direct et enregistre la combinaison", async () => {
    setup();

    const colorGroup = screen.getByRole("group", { name: labels.colorLegend });
    const expressionGroup = screen.getByRole("group", { name: labels.expressionLegend });
    const glassesGroup = screen.getByRole("group", { name: labels.glassesLegend });
    const hatGroup = screen.getByRole("group", { name: labels.hatLegend });
    const accessoryGroup = screen.getByRole("group", { name: labels.accessoryLegend });
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();

    fireEvent.click(within(colorGroup).getByRole("radio", { name: labels.colors.coral }));
    fireEvent.click(within(expressionGroup).getByRole("radio", { name: labels.expressions.wink }));
    fireEvent.click(within(glassesGroup).getByRole("radio", { name: labels.glasses.shades }));
    fireEvent.click(within(hatGroup).getByRole("radio", { name: labels.hats.cap }));
    fireEvent.click(within(accessoryGroup).getByRole("radio", { name: labels.accessories.scarf }));

    const preview = screen.getByRole("img");
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.colors.coral));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.expressions.wink));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.glasses.shades));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.hats.cap));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.accessories.scarf));
    const decodedSvg = decodeURIComponent(preview.getAttribute("src") ?? "");
    expect(decodedSvg).toContain('id="Expression-wink"');
    expect(decodedSvg).toContain('id="Glasses-shades"');
    expect(decodedSvg).toContain('id="Hat-cap"');
    expect(decodedSvg).toContain('id="Accessory-scarf"');

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.save }));
    });

    expect(mocks.updateBlobStyle).toHaveBeenCalledTimes(1);
    const sent = Object.fromEntries(mocks.updateBlobStyle.mock.calls[0][0].entries());
    expect(sent).toEqual({
      color: "coral",
      expression: "wink",
      glasses: "shades",
      hat: "cap",
      accessory: "scarf",
    });
    expect(screen.getByText(plain(labels.saved))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();
  });

  it("permet d'annuler ou de revenir au style par défaut", () => {
    setup({
      color: "lavender",
      expression: "cat",
      glasses: "round",
      hat: "crown",
      accessory: "bowtie",
    });

    const colorGroup = screen.getByRole("group", { name: labels.colorLegend });
    const expressionGroup = screen.getByRole("group", { name: labels.expressionLegend });
    const glassesGroup = screen.getByRole("group", { name: labels.glassesLegend });
    const hatGroup = screen.getByRole("group", { name: labels.hatLegend });
    const accessoryGroup = screen.getByRole("group", { name: labels.accessoryLegend });

    fireEvent.click(screen.getByRole("button", { name: labels.reset }));
    expect(within(colorGroup).getByRole("radio", { name: labels.colors.sky })).toBeChecked();
    expect(within(expressionGroup).getByRole("radio", { name: labels.expressions.smile })).toBeChecked();
    expect(within(glassesGroup).getByRole("radio", { name: labels.glasses.none })).toBeChecked();
    expect(within(hatGroup).getByRole("radio", { name: labels.hats.none })).toBeChecked();
    expect(within(accessoryGroup).getByRole("radio", { name: labels.accessories.none })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: labels.cancel }));
    expect(within(colorGroup).getByRole("radio", { name: labels.colors.lavender })).toBeChecked();
    expect(within(expressionGroup).getByRole("radio", { name: labels.expressions.cat })).toBeChecked();
    expect(within(glassesGroup).getByRole("radio", { name: labels.glasses.round })).toBeChecked();
    expect(within(hatGroup).getByRole("radio", { name: labels.hats.crown })).toBeChecked();
    expect(within(accessoryGroup).getByRole("radio", { name: labels.accessories.bowtie })).toBeChecked();
  });

  it("annonce une erreur serveur traduite dans la région aria-live", async () => {
    mocks.updateBlobStyle.mockResolvedValue({ ok: false, code: "RATE_LIMITED" });
    setup();

    fireEvent.click(screen.getByRole("radio", { name: labels.colors.mint }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.save }));
    });

    const alertText = screen.getByText(plain(labels.errors.RATE_LIMITED));
    expect(alertText.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("désactive l'édition pour le compte de démonstration", () => {
    setup(DEFAULT_BLOB_STYLE, true);
    expect(screen.getByRole("radio", { name: labels.colors.coral })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.randomize })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();
  });
});
