import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useNowPlayingSheet } from "@/state/NowPlayingSheet";

// Links to /now-playing (like tapping the playback notification) slide the Now Playing sheet
// up over whatever was showing
export default function NowPlayingLink() {
  const router = useRouter();
  const { open } = useNowPlayingSheet();

  useEffect(() => {
    open();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [open, router]);

  return null;
}
