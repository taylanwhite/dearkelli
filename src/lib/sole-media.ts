/**
 * Ensure only one <audio>/<video> plays at a time on the page.
 * Call from a media element's `play` handler (or onPlay).
 */
export function pauseOtherMedia(except: HTMLMediaElement) {
  if (typeof document === "undefined") return;
  for (const node of document.querySelectorAll("audio, video")) {
    if (
      node !== except &&
      node instanceof HTMLMediaElement &&
      !node.paused
    ) {
      node.pause();
    }
  }
}
