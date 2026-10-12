import {
  resetRadioTimer,
  setRadioTimerElapsed,
  getRadioTimerElapsed,
  isRadioSetComplete,
  RADIO_SET_SECONDS,
} from "@/scripts/radioTimer";

describe("radioTimer", () => {
  beforeEach(() => {
    resetRadioTimer();
  });

  test("starts with 0 offset and mirrors native position", () => {
    expect(getRadioTimerElapsed(0)).toBe(0);
    expect(getRadioTimerElapsed(45)).toBe(45);
    expect(isRadioSetComplete(45)).toBe(false);
  });

  test("adjusts elapsed time forward without exceeding set duration", () => {
    // At native position 10s, user drags slider to 300s (5 minutes)
    setRadioTimerElapsed(300, 10);
    expect(getRadioTimerElapsed(10)).toBe(300);
    // 5 seconds later
    expect(getRadioTimerElapsed(15)).toBe(305);
    expect(isRadioSetComplete(15)).toBe(false);
  });

  test("adjusts elapsed time backward to extend set", () => {
    // At native position 500s, user drags slider back to 0s
    setRadioTimerElapsed(0, 500);
    expect(getRadioTimerElapsed(500)).toBe(0);
    expect(getRadioTimerElapsed(560)).toBe(60);
    expect(isRadioSetComplete(560)).toBe(false);
  });

  test("completes set when elapsed reaches RADIO_SET_SECONDS", () => {
    // Set dragged to the end
    setRadioTimerElapsed(RADIO_SET_SECONDS, 50);
    expect(getRadioTimerElapsed(50)).toBe(RADIO_SET_SECONDS);
    expect(isRadioSetComplete(50)).toBe(true);
  });

  test("resetRadioTimer restores default 0 offset", () => {
    setRadioTimerElapsed(300, 10);
    expect(getRadioTimerElapsed(10)).toBe(300);
    resetRadioTimer();
    expect(getRadioTimerElapsed(10)).toBe(10);
  });
});
