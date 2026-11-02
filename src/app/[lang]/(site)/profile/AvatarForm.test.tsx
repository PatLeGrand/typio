import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { MAX_AVATAR_BYTES, type AvatarResult } from "@/profile/avatar";

const mocks = vi.hoisted(() => ({
  uploadAvatar: vi.fn<() => Promise<AvatarResult>>(),
  removeAvatar: vi.fn<() => Promise<AvatarResult>>(),
}));
vi.mock("./avatarActions", () => mocks);

import { AvatarForm } from "./AvatarForm";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.uploadAvatar.mockResolvedValue({ ok: true, version: 42 });
  mocks.removeAvatar.mockResolvedValue({ ok: true, version: null });
});

describe.each(["fr", "en"] as const)("AvatarForm (%s)", (locale) => {
  const labels = getDictionary(locale).profile.avatar;
  const setup = () => {
    render(<AvatarForm userId="member" displayName="Alice" version={null} labels={labels} />);
    return screen.getByLabelText(labels.file);
  };

  it("affiche l'URL versionnée après téléversement et l'initiale après retrait", async () => {
    const input = setup();
    fireEvent.change(input, { target: { files: [new File(["image"], "photo.png")] } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(screen.getByAltText(labels.preview)).toHaveAttribute("src", "/api/avatars/member?v=42");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: labels.remove })); });
    expect(screen.queryByAltText(labels.preview)).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("annonce le dépassement de taille sans appeler le serveur", () => {
    const input = setup();
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "large.png")] } });
    expect(screen.getByText(labels.errors.TOO_LARGE)).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: labels.upload })).toBeDisabled();
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
  });

  it("annonce le refus de format du serveur dans la langue de la page", async () => {
    const input = setup();
    mocks.uploadAvatar.mockResolvedValue({ ok: false, code: "UNSUPPORTED_TYPE" });
    fireEvent.change(input, { target: { files: [new File(["gif"], "photo.gif")] } });
    await act(async () => { fireEvent.submit(input.closest("form")!); });
    expect(screen.getByText(labels.errors.UNSUPPORTED_TYPE)).toHaveAttribute("aria-live", "polite");
  });
});
