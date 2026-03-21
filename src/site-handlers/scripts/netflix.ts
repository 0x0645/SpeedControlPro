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

    const videoPlayer = (window as any).netflix.appContext.state.playerApp.getAPI().videoPlayer;
    const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
    const currentTime = videoPlayer.getCurrentTimeBySessionId(playerSessionId);
    videoPlayer.getVideoPlayerBySessionId(playerSessionId).seek(currentTime + event.data.seekMs);
  },
  false
);
