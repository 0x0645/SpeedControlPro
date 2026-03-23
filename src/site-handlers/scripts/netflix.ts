type NetflixVideoPlayerApi = {
  getAllPlayerSessionIds: () => string[];
  getCurrentTimeBySessionId: (sessionId: string) => number;
  getVideoPlayerBySessionId: (sessionId: string) => { seek: (offsetMs: number) => void };
};

function getNetflixVideoPlayer(): NetflixVideoPlayerApi | null {
  const w = window as Window & {
    netflix?: {
      appContext?: {
        state?: {
          playerApp?: {
            getAPI: () => { videoPlayer: NetflixVideoPlayerApi };
          };
        };
      };
    };
  };
  return w.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer ?? null;
}

window.addEventListener(
  'message',
  (event: MessageEvent) => {
    if (
      event.origin !== 'https://www.netflix.com' ||
      event.data.action !== 'videospeed-seek' ||
      !event.data.seekMs
    ) {
      return;
    }

    const videoPlayer = getNetflixVideoPlayer();
    if (!videoPlayer) {
      return;
    }
    const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
    const currentTime = videoPlayer.getCurrentTimeBySessionId(playerSessionId);
    videoPlayer.getVideoPlayerBySessionId(playerSessionId).seek(currentTime + event.data.seekMs);
  },
  false
);
