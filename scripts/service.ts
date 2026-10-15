import TrackPlayer, { Event } from "react-native-track-player";

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await TrackPlayer.play();
    } catch (err) {
      console.error("RemotePlay error:", err);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await TrackPlayer.pause();
    } catch (err) {
      console.error("RemotePause error:", err);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (queue.length === 0 || trackIndex === undefined) return;

      if (trackIndex >= queue.length - 1) {
        await TrackPlayer.skip(0);
      } else {
        await TrackPlayer.skipToNext();
      }
    } catch (err) {
      console.error("RemoteNext error:", err);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      const progress = await TrackPlayer.getProgress();
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }

      const queue = await TrackPlayer.getQueue();
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      if (queue.length === 0 || trackIndex === undefined) return;

      if (trackIndex === 0) {
        await TrackPlayer.skip(queue.length - 1);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (err) {
      console.error("RemotePrevious error:", err);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
    try {
      await TrackPlayer.seekTo(position);
    } catch (err) {
      console.error("RemoteSeek error:", err);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused, permanent }) => {
    try {
      if (permanent || paused) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (err) {
      console.error("RemoteDuck error:", err);
    }
  });
};
