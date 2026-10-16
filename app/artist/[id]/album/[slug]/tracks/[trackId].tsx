import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function TrackView() {
  const { slug, id } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (id && slug) {
      router.replace(`/artist/${id}/album/${slug}/album-tracks`);
    }
  }, [id, slug, router]);

  return null;
}
