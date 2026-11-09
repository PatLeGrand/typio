import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { InteractiveVideo } from "./InteractiveVideo";

const labels = getDictionary("fr").home.media;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([true, false])("respects reduced motion (%s) and synchronizes the keyboard control with media events", (reduced) => {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("blocked"));
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<InteractiveVideo ariaLabel={labels.videoLabel} fallbackText={labels.videoDescription} src="/videos/typio-intro.mp4" playLabel={labels.videoPlay} pauseLabel={labels.videoPause} details={labels.videoDetails} />);
  const video = screen.getByLabelText(labels.videoLabel);
  expect(video).not.toHaveAttribute("autoplay");
  expect(video).toHaveAccessibleDescription(labels.videoDetails);
  if (reduced) expect(play).not.toHaveBeenCalled();
  else expect(play).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: labels.videoPlay }));
  expect(play).toHaveBeenCalled();
  fireEvent.play(video);
  vi.spyOn(video as HTMLVideoElement, "paused", "get").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: labels.videoPause }));
  expect(pause).toHaveBeenCalled();
  fireEvent.pause(video);
  expect(screen.getByRole("button", { name: labels.videoPlay })).toBeVisible();
});

it("keeps a manual pause when reduced motion is disabled again", () => {
  let matches = false;
  let changed: () => void = () => {};
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: (_: string, listener: () => void) => { changed = listener; },
    removeEventListener: vi.fn(),
  }));
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<InteractiveVideo ariaLabel={labels.videoLabel} fallbackText={labels.videoDescription} src="/videos/typio-intro.mp4" playLabel={labels.videoPlay} pauseLabel={labels.videoPause} details={labels.videoDetails} />);
  const video = screen.getByLabelText(labels.videoLabel);
  fireEvent.play(video);
  vi.spyOn(video as HTMLVideoElement, "paused", "get").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: labels.videoPause }));
  fireEvent.pause(video);
  play.mockClear();
  act(() => { matches = true; changed(); });
  act(() => { matches = false; changed(); });
  expect(play).not.toHaveBeenCalled();
  vi.spyOn(video as HTMLVideoElement, "paused", "get").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: labels.videoPlay }));
  expect(play).toHaveBeenCalledOnce();
});
