export {};

declare global {
  interface Window {
    desktopAPI?: {
      saveMediaFile: (payload: { name: string; bytes: number[] }) => Promise<string>;
    };
    _bgMusicAudio?: HTMLAudioElement;
  }
}
