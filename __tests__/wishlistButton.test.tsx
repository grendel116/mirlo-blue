jest.mock("@preeternal/react-native-cookie-manager", () => ({
  __esModule: true,
  default: { get: jest.fn(), getAll: jest.fn(), clearAll: jest.fn() },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import WishlistButton from "@/components/WishlistButton";
import { AUTH_PROFILE_QUERY_KEY } from "@/queries/authQueries";

const mockPush = jest.fn();
const mockPost = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefreshLoggedInUser = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

jest.mock("@/queries/fetch/fetchWrapper", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

let mockUser: any = {
  id: 42,
  wishlist: [],
  trackFavorites: [],
};

jest.mock("@/state/AuthContext", () => ({
  useAuthContext: () => ({
    user: mockUser,
    refreshLoggedInUser: mockRefreshLoggedInUser,
  }),
}));

describe("<WishlistButton />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({});
    mockUser = {
      id: 42,
      wishlist: [],
      trackFavorites: [],
    };
  });

  test("redirects unauthenticated users to verification modal", () => {
    mockUser = null;
    const { getByRole } = render(
      <WishlistButton
        trackGroup={{ id: 10, tracks: [] }}
        displayedTracks={[]}
      />,
    );

    fireEvent.press(getByRole("button"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/emailVerificationModal",
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  test("liking an album likes only displayed tracks and ignores invisible tracks", async () => {
    mockUser = {
      id: 42,
      wishlist: [],
      trackFavorites: [],
    };

    // Album has 3 tracks in raw trackGroup, but only 2 are displayed in UI (1 is invisible/separated)
    const rawTrackGroup = {
      id: 10,
      tracks: [
        { id: 101, title: "Displayed 1" } as any,
        { id: 102, title: "Displayed 2" } as any,
        { id: 999, title: "Invisible Track" } as any,
      ],
    };

    const displayedTracks = [
      { id: 101, title: "Displayed 1" } as any,
      { id: 102, title: "Displayed 2" } as any,
    ];

    const { getByRole } = render(
      <WishlistButton
        trackGroup={rawTrackGroup}
        displayedTracks={displayedTracks}
      />,
    );

    fireEvent.press(getByRole("button"));

    await waitFor(() => {
      // Album wishlist call
      expect(mockPost).toHaveBeenCalledWith("/v1/trackGroups/10/wishlist", {
        wishlist: true,
      });

      // Displayed tracks must be liked
      expect(mockPost).toHaveBeenCalledWith("/v1/tracks/101/favorite", {
        favorite: true,
      });
      expect(mockPost).toHaveBeenCalledWith("/v1/tracks/102/favorite", {
        favorite: true,
      });

      // Invisible track 999 MUST NOT be liked!
      expect(mockPost).not.toHaveBeenCalledWith("/v1/tracks/999/favorite", expect.anything());
    });

    // Verify optimistic update on AUTH_PROFILE_QUERY_KEY
    expect(mockSetQueryData).toHaveBeenCalledWith(
      AUTH_PROFILE_QUERY_KEY,
      expect.any(Function),
    );

    const updateProfileFn = mockSetQueryData.mock.calls.find(
      (c) => c[0] === AUTH_PROFILE_QUERY_KEY,
    )[1];

    const updatedUser = updateProfileFn({
      id: 42,
      wishlist: [],
      trackFavorites: [],
    });

    expect(updatedUser.wishlist).toEqual([{ userId: 42, trackGroupId: 10 }]);
    expect(updatedUser.trackFavorites).toHaveLength(2);
    expect(updatedUser.trackFavorites.map((f: any) => f.trackId)).toEqual([101, 102]);
  });

  test("unliking an album removes all displayed track likes", async () => {
    mockUser = {
      id: 42,
      wishlist: [{ trackGroupId: 10, userId: 42 }],
      trackFavorites: [
        { trackId: 101, userId: 42, track: { id: 101, trackGroupId: 10 } },
        { trackId: 102, userId: 42, track: { id: 102, trackGroupId: 10 } },
        { trackId: 200, userId: 42, track: { id: 200, trackGroupId: 99 } }, // Unrelated track
      ],
    };

    const trackGroup = { id: 10 };
    const displayedTracks = [
      { id: 101, title: "Track 1" } as any,
      { id: 102, title: "Track 2" } as any,
    ];

    const { getByRole } = render(
      <WishlistButton
        trackGroup={trackGroup}
        displayedTracks={displayedTracks}
      />,
    );

    fireEvent.press(getByRole("button"));

    await waitFor(() => {
      // Album wishlist call
      expect(mockPost).toHaveBeenCalledWith("/v1/trackGroups/10/wishlist", {
        wishlist: false,
      });

      // Displayed tracks unliked
      expect(mockPost).toHaveBeenCalledWith("/v1/tracks/101/favorite", {
        favorite: false,
      });
      expect(mockPost).toHaveBeenCalledWith("/v1/tracks/102/favorite", {
        favorite: false,
      });

      // Unrelated track 200 untouched
      expect(mockPost).not.toHaveBeenCalledWith("/v1/tracks/200/favorite", expect.anything());
    });

    // Verify optimistic cache removal
    const updateProfileFn = mockSetQueryData.mock.calls.find(
      (c) => c[0] === AUTH_PROFILE_QUERY_KEY,
    )[1];

    const updatedUser = updateProfileFn(mockUser);
    expect(updatedUser.wishlist).toEqual([]);
    expect(updatedUser.trackFavorites).toEqual([
      { trackId: 200, userId: 42, track: { id: 200, trackGroupId: 99 } },
    ]);
  });
});
