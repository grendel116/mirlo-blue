import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BackHandler, useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

// Now Playing slides over the app as a sheet that follows the finger. `progress` runs from 0
// (closed, below the screen) to 1 (open); the motion runs on the UI thread, so it stays smooth
// while the app is busy
type NowPlayingSheetContextType = {
  progress: SharedValue<number>;
  height: SharedValue<number>;
  // True while any part of the sheet shows; Now Playing updates its clock only then
  visible: boolean;
  // True once the sheet has opened, so its contents load on first use
  hasOpened: boolean;
  open: () => void;
  close: () => void;
  // For gestures that move the sheet themselves: show it as a drag begins, hide it once closed
  show: () => void;
  hide: () => void;
};

const NowPlayingSheetContext = createContext<NowPlayingSheetContextType | null>(null);

const SETTLE_MS = 240;
// A flick this fast (points per second) finishes the motion in its direction
const FLICK_VELOCITY = 600;

function settle(progress: SharedValue<number>, toOpen: boolean, onClosed: () => void) {
  "worklet";
  progress.value = withTiming(toOpen ? 1 : 0, { duration: SETTLE_MS }, (finished) => {
    if (finished && !toOpen) runOnJS(onClosed)();
  });
}

export function NowPlayingSheetProvider({ children }: { children: ReactNode }) {
  const { height: windowHeight } = useWindowDimensions();
  const progress = useSharedValue(0);
  const height = useSharedValue(windowHeight);
  const [visible, setVisible] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    height.value = windowHeight;
  }, [windowHeight, height]);

  const show = useCallback(() => {
    setVisible(true);
    setHasOpened(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);

  const open = useCallback(() => {
    show();
    settle(progress, true, hide);
  }, [progress, show, hide]);

  const close = useCallback(() => settle(progress, false, hide), [progress, hide]);

  // Android Back closes the sheet before it leaves the screen underneath
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [visible, close]);

  const value = useMemo(
    () => ({ progress, height, visible, hasOpened, open, close, show, hide }),
    [progress, height, visible, hasOpened, open, close, show, hide],
  );

  return (
    <NowPlayingSheetContext.Provider value={value}>{children}</NowPlayingSheetContext.Provider>
  );
}

export function useNowPlayingSheet(): NowPlayingSheetContextType {
  const context = useContext(NowPlayingSheetContext);
  if (!context) {
    throw new Error("useNowPlayingSheet must be used within a NowPlayingSheetProvider");
  }
  return context;
}

// The mini player: drag it up to pull Now Playing over the app, or tap it to open
export function useMiniPlayerGesture() {
  const { progress, height, open, show, hide } = useNowPlayingSheet();

  return useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-16, 16])
      .onStart(() => {
        runOnJS(show)();
      })
      .onUpdate((event) => {
        progress.value = Math.min(1, Math.max(0, -event.translationY / height.value));
      })
      .onEnd((event) => {
        const toOpen =
          event.velocityY < -FLICK_VELOCITY ||
          (event.velocityY < FLICK_VELOCITY && progress.value > 0.3);
        settle(progress, toOpen, hide);
      });
    const tap = Gesture.Tap().onEnd(() => {
      runOnJS(open)();
    });
    return Gesture.Exclusive(pan, tap);
  }, [progress, height, open, show, hide]);
}

// The open sheet: drag down to close it. Its scroll view scrolls as usual; the sheet follows
// the finger when a downward drag starts with the contents scrolled to the top
export function useSheetGesture() {
  const { progress, height, hide } = useNowPlayingSheet();
  const scrollOffset = useSharedValue(0);
  const startedAtTop = useSharedValue(true);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffset.value = event.contentOffset.y;
  });

  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-16, 16])
        .simultaneousWithExternalGesture(scrollGesture)
        .onStart(() => {
          startedAtTop.value = scrollOffset.value <= 0;
        })
        .onUpdate((event) => {
          if (!startedAtTop.value) return;
          progress.value = Math.min(1, Math.max(0, 1 - event.translationY / height.value));
        })
        .onEnd((event) => {
          if (!startedAtTop.value) return;
          const toClose =
            event.velocityY > FLICK_VELOCITY ||
            (event.velocityY > -FLICK_VELOCITY && progress.value < 0.7);
          settle(progress, !toClose, hide);
        }),
    [progress, height, hide, scrollGesture, scrollOffset, startedAtTop],
  );

  return { panGesture, scrollGesture, scrollHandler };
}
