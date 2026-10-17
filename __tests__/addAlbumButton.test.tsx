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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddAlbumButton from "@/components/AddAlbumButton";
import { openPurchase } from "@/scripts/openPurchase";

const mockPush = jest.fn();
const mockPost = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
}));

jest.mock("@/scripts/openPurchase", () => ({
  openPurchase: jest.fn(),
}));

let mockUser: any = {
  id: 42,
  userTrackGroupPurchases: [],
};

jest.mock("@/state/AuthContext", () => ({
  useAuthContext: () => ({
    user: mockUser,
  }),
}));

jest.mock("@/queries/fetch/fetchWrapper", () => ({
  post: (...args: unknown[]) => mockPost(...args),
}));

describe("<AddAlbumButton />", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockPost.mockResolvedValue({});
    mockUser = {
      id: 42,
      userTrackGroupPurchases: [],
    };
  });

  const renderWithClient = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  const freeMirloAlbum: AlbumProps = {
    id: 101,
    title: "Free Album",
    source: "Mirlo Space",
    minPrice: 0,
    artistId: 10,
    urlSlug: "free-album",
    artist: { id: 10, name: "Artist", urlSlug: "artist-slug" },
    tracks: [{ id: 1, title: "Track 1" }],
  } as any;

  const paidMirloAlbum: AlbumProps = {
    id: 102,
    title: "Paid Album",
    source: "Mirlo Space",
    minPrice: 500,
    artistId: 10,
    urlSlug: "paid-album",
    artist: { id: 10, name: "Artist", urlSlug: "artist-slug" },
    tracks: [{ id: 2, title: "Track 2" }],
  } as any;

  test("opens purchase modal for paid albums", () => {
    const { getByRole } = renderWithClient(<AddAlbumButton trackGroup={paidMirloAlbum} />);
    const button = getByRole("button");
    fireEvent.press(button);

    expect(openPurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: "album",
        slug: "paid-album",
      }),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  test("claims free album automatically without opening modal when shop button is pressed", async () => {
    const { getByRole } = renderWithClient(<AddAlbumButton trackGroup={freeMirloAlbum} />);
    const button = getByRole("button");
    fireEvent.press(button);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/v1/purchase",
        expect.objectContaining({
          artistId: 10,
          items: [{ type: "trackGroup", id: 101, price: "0" }],
          deferred: true,
        }),
      );
    });

    expect(openPurchase).not.toHaveBeenCalled();
  });

  test("redirects to login when unauthenticated listener presses shop button on free album", () => {
    mockUser = null;
    const { getByRole } = renderWithClient(<AddAlbumButton trackGroup={freeMirloAlbum} />);
    const button = getByRole("button");
    fireEvent.press(button);

    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(openPurchase).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  test("renders nothing when the album is already owned", () => {
    mockUser = {
      id: 42,
      userTrackGroupPurchases: [{ trackGroupId: 101 }],
    };
    const { toJSON } = renderWithClient(<AddAlbumButton trackGroup={freeMirloAlbum} />);
    expect(toJSON()).toBeNull();
  });
});
