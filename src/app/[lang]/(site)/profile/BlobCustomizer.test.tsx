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
      glasses: formData.get("glasses") as BlobStyle["glasses"],
      hat: formData.get("hat") as BlobStyle["hat"],
    },
  }));
});

describe.each(["fr", "en"] as const)("BlobCustomizer (%s)", (locale) => {
  const labels = getDictionary(locale).profile.blob;

  const setup = (initialStyle: BlobStyle = DEFAULT_BLOB_STYLE, isDemo = false) =>
    render(<BlobCustomizer initialStyle={initialStyle} isDemo={isDemo} labels={labels} />);

  it("affiche les trois groupes accessibles, met à jour l'aperçu en direct et enregistre la combinaison", async () => {
    setup();

    const colorGroup = screen.getByRole("group", { name: labels.colorLegend });
    const glassesGroup = screen.getByRole("group", { name: labels.glassesLegend });
    const hatGroup = screen.getByRole("group", { name: labels.hatLegend });
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();

    fireEvent.click(within(colorGroup).getByRole("radio", { name: labels.colors.coral }));
    fireEvent.click(within(glassesGroup).getByRole("radio", { name: labels.glasses.shades }));
    fireEvent.click(within(hatGroup).getByRole("radio", { name: labels.hats.cap }));

    const preview = screen.getByRole("img");
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.colors.coral));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.glasses.shades));
    expect(preview).toHaveAttribute("alt", expect.stringContaining(labels.hats.cap));
    expect(decodeURIComponent(preview.getAttribute("src") ?? "")).toContain('id="Glasses-shades"');
    expect(decodeURIComponent(preview.getAttribute("src") ?? "")).toContain('id="Hat-cap"');

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: labels.save }));
    });

    expect(mocks.updateBlobStyle).toHaveBeenCalledTimes(1);
    const sent = Object.fromEntries(mocks.updateBlobStyle.mock.calls[0][0].entries());
    expect(sent).toEqual({ color: "coral", glasses: "shades", hat: "cap" });
    expect(screen.getByText(plain(labels.saved))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();
  });

  it("permet d'annuler ou de revenir au style par défaut", () => {
    setup({ color: "lavender", glasses: "round", hat: "crown" });

    const colorGroup = screen.getByRole("group", { name: labels.colorLegend });
    const glassesGroup = screen.getByRole("group", { name: labels.glassesLegend });
    const hatGroup = screen.getByRole("group", { name: labels.hatLegend });

    fireEvent.click(screen.getByRole("button", { name: labels.reset }));
    expect(within(colorGroup).getByRole("radio", { name: labels.colors.sky })).toBeChecked();
    expect(within(glassesGroup).getByRole("radio", { name: labels.glasses.none })).toBeChecked();
    expect(within(hatGroup).getByRole("radio", { name: labels.hats.none })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: labels.cancel }));
    expect(within(colorGroup).getByRole("radio", { name: labels.colors.lavender })).toBeChecked();
    expect(within(glassesGroup).getByRole("radio", { name: labels.glasses.round })).toBeChecked();
    expect(within(hatGroup).getByRole("radio", { name: labels.hats.crown })).toBeChecked();
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
    expect(screen.getByRole("button", { name: labels.save })).toBeDisabled();
  });
});
