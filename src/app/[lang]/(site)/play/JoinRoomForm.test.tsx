import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { JoinRoomForm } from "./JoinRoomForm";

function renderForm(locale: "fr" | "en", options: { disabled?: boolean } = {}) {
  const { room } = getDictionary(locale);
  const onJoin = vi.fn();
  render(
    <JoinRoomForm
      labels={room.play.join}
      invalidCodeMessage={room.errors.INVALID_CODE}
      disabled={options.disabled ?? false}
      onJoin={onJoin}
    />,
  );
  return { labels: room.play.join, errors: room.errors, onJoin };
}

describe.each(["fr", "en"] as const)("formulaire « rejoindre avec un code » (%s)", (locale) => {
  it("met le code en majuscules, sans espaces ni tirets, sur 6 caractères au plus", () => {
    const { labels } = renderForm(locale);
    const field = screen.getByLabelText(labels.codeLabel);

    fireEvent.change(field, { target: { value: "abc-def" } });
    expect(field).toHaveValue("ABCDEF");
    fireEvent.change(field, { target: { value: " ab c2 " } });
    expect(field).toHaveValue("ABC2");
    fireEvent.change(field, { target: { value: "abcdefghij" } });
    expect(field).toHaveValue("ABCDEF");
  });

  it("refuse un code incomplet ou aux caractères exclus : message traduit, aucun envoi", () => {
    const { labels, errors, onJoin } = renderForm(locale);
    const field = screen.getByLabelText(labels.codeLabel);

    fireEvent.change(field, { target: { value: "ABC" } });
    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    expect(field).toBeInvalid();
    expect(screen.getByText(errors.INVALID_CODE)).toBeVisible();

    // 0, O, 1, I et L n'existent pas dans l'alphabet des codes (H-5).
    fireEvent.change(field, { target: { value: "ABC0O1" } });
    expect(screen.queryByText(errors.INVALID_CODE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    expect(screen.getByText(errors.INVALID_CODE)).toBeVisible();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("envoie le code normalisé et le rôle choisi (coureur par défaut)", () => {
    const { labels, onJoin } = renderForm(locale);
    const field = screen.getByLabelText(labels.codeLabel);

    fireEvent.change(field, { target: { value: "abc234" } });
    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    expect(onJoin).toHaveBeenLastCalledWith("ABC234", "runner");

    fireEvent.click(screen.getByRole("radio", { name: labels.spectator }));
    fireEvent.click(screen.getByRole("button", { name: labels.button }));
    expect(onJoin).toHaveBeenLastCalledWith("ABC234", "spectator");
  });

  it("regroupe les rôles dans un fieldset avec sa légende", () => {
    const { labels } = renderForm(locale);
    const group = screen.getByRole("group", { name: labels.roleLabel });
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByRole("radio", { name: labels.runner })).toBeChecked();
    expect(screen.getByRole("radio", { name: labels.spectator })).not.toBeChecked();
  });

  it("désactivé : champ, rôles et bouton sont inertes", () => {
    const { labels } = renderForm(locale, { disabled: true });
    expect(screen.getByLabelText(labels.codeLabel)).toBeDisabled();
    expect(screen.getByRole("radio", { name: labels.runner })).toBeDisabled();
    expect(screen.getByRole("button", { name: labels.button })).toBeDisabled();
  });
});
