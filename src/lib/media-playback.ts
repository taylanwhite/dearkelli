export function stopAllMediaPlayback() {
  document.querySelectorAll("video, audio").forEach((el) => {
    const media = el as HTMLMediaElement;
    media.pause();
    try {
      media.currentTime = 0;
    } catch {
      // ignore
    }
  });
}
