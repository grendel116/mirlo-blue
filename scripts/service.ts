import TrackPlayer, { Event, RepeatMode } from "react-native-track-player";
import { RADIO_SET_SECONDS } from "@/queries/radio";

// Next track, wrapping to the start at the end of the queue
async function skipToNextTrack() {
  const queue = await TrackPlayer.getQueue();
  const trackIndex = await TrackPlayer.getActiveTrackIndex();
  if (queue.length === 0 || trackIndex === undefined) return;

  if (trackIndex >= queue.length - 1) {
    await TrackPlayer.skip(0);
  } else {
    await TrackPlayer.skipToNext();
  }
}

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
      await skipToNextTrack();
    } catch (err) {
      console.error("RemoteNext error:", err);
    }
  });

  // A station's set ends after 10 minutes of listening (repeat one keeps it on)
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async ({ position }) => {
    try {
      if (position < RADIO_SET_SECONDS) return;
      const active = (await TrackPlayer.getActiveTrack()) as RNTrack | undefined;
      if (!active?.liveStation) return;
      if ((await TrackPlayer.getRepeatMode()) === RepeatMode.Track) return;
      await skipToNextTrack();
    } catch (err) {
      console.error("Radio set error:", err);
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

  // Other sound took over (paused), or handed the speaker back (not paused). A permanent
  // takeover, like another music app, leaves the music paused. A passing one, like a call or a
  // video, resumes the music afterwards, but only when it was playing when the sound began
  let interruptedWhilePlaying = false;
  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused, permanent }) => {
    try {
      if (paused) {
        const wasPlaying = await TrackPlayer.getPlayWhenReady();
        if (wasPlaying) await TrackPlayer.pause();
        interruptedWhilePlaying = !permanent && (wasPlaying || interruptedWhilePlaying);
      } else {
        if (interruptedWhilePlaying) await TrackPlayer.play();
        interruptedWhilePlaying = false;
      }
    } catch (err) {
      console.error("RemoteDuck error:", err);
    }
  });
};
