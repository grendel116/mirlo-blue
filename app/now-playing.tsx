import { useEffect } from "react";
import { useRouter } from "expo-router";
import { openNowPlaying } from "@/components/NowPlaying";

// Links to /now-playing (like tapping the playback notification) slide the Now Playing sheet
// up over whatever was showing
export default function NowPlayingLink() {
  const router = useRouter();

  useEffect(() => {
    openNowPlaying();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  return null;
}
