const orphanAudio = new Set<HTMLAudioElement>();

export function trackOrphanAudio(audio: HTMLAudioElement) {
  orphanAudio.add(audio);
}

export function untrackOrphanAudio(audio: HTMLAudioElement) {
  orphanAudio.delete(audio);
}

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

  orphanAudio.forEach((audio) => {
    audio.pause();
    audio.src = "";
  });
  orphanAudio.clear();
}
