export const RADIO_SET_SECONDS = 10 * 60;

let elapsedOffset = 0;

export function resetRadioTimer(): void {
  elapsedOffset = 0;
}

export function setRadioTimerElapsed(desiredElapsed: number, nativePosition: number): void {
  elapsedOffset = Math.max(0, Math.min(RADIO_SET_SECONDS, desiredElapsed)) - nativePosition;
}

export function getRadioTimerElapsed(nativePosition: number): number {
  return Math.max(0, Math.min(RADIO_SET_SECONDS, nativePosition + elapsedOffset));
}

export function isRadioSetComplete(nativePosition: number): boolean {
  return getRadioTimerElapsed(nativePosition) >= RADIO_SET_SECONDS;
}
