import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { DEFAULT_ROOM_CONFIG, type RoomConfig, type RoomConfigPatch } from "@/realtime/protocol";
import { EXCLUDED_SEND_DELAY_MS, RoomConfigPanel } from "./RoomConfigPanel";

const { room: roomLabels, raceSettings } = getDictionary("fr");

type Send = (patch: RoomConfigPatch) => Promise<unknown>;

function setup(options: { editable?: boolean; config?: RoomConfig; onChange?: Send } = {}) {
  const onChange = options.onChange ?? vi.fn<Send>(async () => undefined);
  const ui = (config: RoomConfig) => (
    <RoomConfigPanel
      config={config}
      editable={options.editable ?? true}
      lang="fr"
      labels={roomLabels.config}
      settingsLabels={raceSettings}
      onChange={onChange}
    />
  );
  const view = render(ui(options.config ?? DEFAULT_ROOM_CONFIG));
  return { onChange, rerender: (config: RoomConfig) => view.rerender(ui(config)) };
}

const excludedField = () => screen.getByRole("textbox", { name: raceSettings.excludedChars.label });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomConfigPanel, host", () => {
  it("sends one protocol patch per changed setting, never abilities", () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole("radio", { name: raceSettings.textMode.words }));
    fireEvent.click(screen.getByRole("radio", { name: raceSettings.accents.exclude }));
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${raceSettings.inputMode.blocking}`) }));
    fireEvent.click(screen.getByRole("radio", { name: raceSettings.botDifficulty.hard }));
    fireEvent.click(screen.getByRole("button", { name: raceSettings.botCount.increase }));

    expect(vi.mocked(onChange).mock.calls).toEqual([
      [{ textMode: "words" }],
      [{ accents: false }],
      [{ inputMode: "blocking" }],
      [{ botDifficulty: "hard" }],
      [{ botCount: DEFAULT_ROOM_CONFIG.botCount + 1 }],
    ]);
  });

  it("does not show the host-only note", () => {
    setup();
    expect(screen.queryByText(roomLabels.config.hostOnly)).not.toBeInTheDocument();
  });

  it("excluded characters: a single send, 500 ms after the last keystroke", () => {
    const { onChange } = setup();

    fireEvent.change(excludedField(), { target: { value: "@" } });
    act(() => void vi.advanceTimersByTime(EXCLUDED_SEND_DELAY_MS - 100));
    fireEvent.change(excludedField(), { target: { value: "@#" } });
    act(() => void vi.advanceTimersByTime(EXCLUDED_SEND_DELAY_MS - 1));
    expect(onChange).not.toHaveBeenCalled();
    expect(excludedField()).toHaveValue("@#");

    act(() => void vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ excludedCharacters: "@#" });
  });

  it("excluded characters: sent at once on blur, not sent again by the timer", async () => {
    const { onChange } = setup();

    fireEvent.change(excludedField(), { target: { value: "xy" } });
    fireEvent.blur(excludedField());
    await act(async () => void vi.advanceTimersByTime(EXCLUDED_SEND_DELAY_MS * 2));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ excludedCharacters: "xy" });
  });

  it("after sending and leaving the field, shows the value normalized by the room", async () => {
    const { onChange, rerender } = setup();

    fireEvent.change(excludedField(), { target: { value: "x y x" } });
    fireEvent.blur(excludedField());
    await act(async () => undefined);
    expect(onChange).toHaveBeenCalledWith({ excludedCharacters: "x y x" });

    rerender({ ...DEFAULT_ROOM_CONFIG, excludedCharacters: "xy" });
    expect(excludedField()).toHaveValue("xy");
  });

  it("while typing, the room state does not overwrite the field", () => {
    const { rerender } = setup();
    fireEvent.change(excludedField(), { target: { value: "ab" } });
    rerender({ ...DEFAULT_ROOM_CONFIG, excludedCharacters: "a" });
    expect(excludedField()).toHaveValue("ab");
  });

  it("refused excluded characters: the field goes back to the room value", async () => {
    const onChange = vi.fn<Send>(async () => ({ ok: false, error: "INVALID_PAYLOAD" }));
    setup({ onChange });

    fireEvent.change(excludedField(), { target: { value: "zz" } });
    fireEvent.blur(excludedField());
    await act(async () => undefined);

    expect(excludedField()).toHaveValue(DEFAULT_ROOM_CONFIG.excludedCharacters);
  });

  it("more than 100 characters: local error, nothing sent", () => {
    const { onChange } = setup();
    fireEvent.change(excludedField(), { target: { value: "a".repeat(101) } });
    act(() => void vi.advanceTimersByTime(EXCLUDED_SEND_DELAY_MS));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(raceSettings.excludedChars.error);
  });

  it("a refused setting does not change what is shown (room state is the source)", () => {
    setup({ onChange: vi.fn<Send>(async () => ({ ok: false, error: "ROOM_FULL" })) });
    fireEvent.click(screen.getByRole("button", { name: raceSettings.botCount.increase }));
    expect(screen.getByText(String(DEFAULT_ROOM_CONFIG.botCount))).toBeInTheDocument();
  });
});

describe("RoomConfigPanel, non-host (SALLE-10)", () => {
  it("read only: room values, disabled controls, note shown", () => {
    const { onChange } = setup({
      editable: false,
      config: { ...DEFAULT_ROOM_CONFIG, language: "en", excludedCharacters: "qz" },
    });

    expect(screen.getByRole("radio", { name: raceSettings.language.en })).toHaveAttribute("aria-checked", "true");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(excludedField()).toHaveValue("qz");
    expect(excludedField()).toHaveAttribute("readonly");
    expect(screen.getByText(roomLabels.config.hostOnly)).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: raceSettings.language.fr }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows the room state without reloading (AC-B2)", () => {
    const { rerender } = setup({ editable: false });
    rerender({ ...DEFAULT_ROOM_CONFIG, textMode: "words", botCount: 5, inputMode: "blocking" });

    expect(screen.getByRole("radio", { name: raceSettings.textMode.words })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: new RegExp(`^${raceSettings.inputMode.blocking}`) })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
