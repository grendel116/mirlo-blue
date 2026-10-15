jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  getDisabledTrackIds,
  markTrackDisabled,
  isTrackDisabledSync,
  clearDisabledTracks,
  reachedMaxPlays,
  incrementPlayCount,
} from "@/scripts/trackPlayUtils";
import { isTrackOwnedOrPreview } from "@/scripts/utils";
import { createMockRNTrack } from "@/__mocks__/mockRNTrack";
import { createMockAlbum } from "@/__mocks__/mockAlbum";
import { createMockUser } from "@/__mocks__/mockUser";

describe("Track play limit and HTTP 402 root-cause handling", () => {
  beforeEach(async () => {
    await clearDisabledTracks();
  });

  test("marks a track as disabled and remembers it in memory and storage", async () => {
    expect(isTrackDisabledSync(1234)).toBe(false);

    await markTrackDisabled(1234);

    expect(isTrackDisabledSync(1234)).toBe(true);
    const set = await getDisabledTrackIds();
    expect(set.has(1234)).toBe(true);
  });

  test("reachedMaxPlays returns true and marks track disabled when threshold is reached", async () => {
    const trackId = 5555;
    // Set up play counts by incrementing
    await incrementPlayCount(trackId);
    await incrementPlayCount(trackId);

    // Limit is 2; 2 plays have occurred
    const reached = await reachedMaxPlays(trackId, 2);
    expect(reached).toBe(true);
    expect(isTrackDisabledSync(trackId)).toBe(true);
  });

  test("incrementPlayCount automatically marks track disabled if maxFreePlays is passed", async () => {
    const trackId = 8888;
    await incrementPlayCount(trackId, 2);
    expect(isTrackDisabledSync(trackId)).toBe(false);

    await incrementPlayCount(trackId, 2);
    expect(isTrackDisabledSync(trackId)).toBe(true);
  });

  test("isTrackOwnedOrPreview disables preview playback when a track is disabled", () => {
    const track = createMockRNTrack({ id: 9999, isPreview: true });
    const album = createMockAlbum();

    // Initially playable as preview
    expect(isTrackOwnedOrPreview(track, null, album)).toBe(true);

    // After being disabled by play limit or HTTP 402
    const disabledSet = new Set<number>([9999]);
    expect(isTrackOwnedOrPreview(track, null, album, disabledSet)).toBe(false);
  });

  test("isTrackOwnedOrPreview allows playback for purchased tracks even if disabled in preview cache", () => {
    const user = {
      ...createMockUser(),
      id: 42,
      userTrackPurchases: [{ trackId: 9999, datePurchased: "2026-01-01" }],
    };
    const track = createMockRNTrack({ id: 9999, isPreview: true });
    const album = createMockAlbum();
    const disabledSet = new Set<number>([9999]);

    // Purchased tracks remain fully playable with no preview limits
    expect(isTrackOwnedOrPreview(track, user, album, disabledSet)).toBe(true);
  });
});
