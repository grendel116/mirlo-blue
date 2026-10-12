import type { QueueSlot } from "@/state/PlayerContext";

export type QueueMetrics = {
  queueCount: number;
  upcomingCount: number;
  firstAutoplayIndex: number;
};

export type QueueDragState = {
  from: QueueSlot;
  target: QueueSlot;
  slotY: number;
  nextUpHeaderOffset: number;
  autoplayDividerOffset: number;
  showEmptyQueueUnderneath: boolean;
};

export const ROW_HEIGHT = 62;
export const NEXT_UP_MARGIN_TOP = 18;
export const NEXT_UP_HEIGHT = 36;
export const NEXT_UP_MARGIN_BOTTOM = 10;
export const NEXT_UP_TOTAL = NEXT_UP_MARGIN_TOP + NEXT_UP_HEIGHT + NEXT_UP_MARGIN_BOTTOM;

export const AUTOPLAY_MARGIN_TOP = 12;
export const AUTOPLAY_HEIGHT = 32;
export const AUTOPLAY_MARGIN_BOTTOM = 6;
export const AUTOPLAY_TOTAL = AUTOPLAY_MARGIN_TOP + AUTOPLAY_HEIGHT + AUTOPLAY_MARGIN_BOTTOM;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export function queueSectionHeight(m: QueueMetrics): number {
  return Math.max(1, m.queueCount) * ROW_HEIGHT;
}

export function nextUpHeaderY(m: QueueMetrics): number {
  return queueSectionHeight(m) + NEXT_UP_MARGIN_TOP;
}

export function upcomingStartY(m: QueueMetrics): number {
  return queueSectionHeight(m) + NEXT_UP_TOTAL;
}

export function autoplayDividerY(m: QueueMetrics): number {
  return upcomingStartY(m) + m.firstAutoplayIndex * ROW_HEIGHT + AUTOPLAY_MARGIN_TOP;
}

export function queueRowY(index: number): number {
  return index * ROW_HEIGHT;
}

export function upcomingRowY(m: QueueMetrics, index: number): number {
  const dividerOffset =
    m.firstAutoplayIndex >= 0 && index >= m.firstAutoplayIndex ? AUTOPLAY_TOTAL : 0;
  return upcomingStartY(m) + index * ROW_HEIGHT + dividerOffset;
}

export function slotBaseY(m: QueueMetrics, slot: QueueSlot): number {
  return slot.section === "queue" ? queueRowY(slot.index) : upcomingRowY(m, slot.index);
}

export function totalDragAreaHeight(m: QueueMetrics): number {
  const qH = queueSectionHeight(m);
  if (m.upcomingCount === 0) return qH;
  const divH = m.firstAutoplayIndex >= 0 ? AUTOPLAY_TOTAL : 0;
  return qH + NEXT_UP_TOTAL + m.upcomingCount * ROW_HEIGHT + divH;
}

/**
 * Returns the O(1) vertical shift offset (-ROW_HEIGHT, 0, or +ROW_HEIGHT) for any row during drag.
 */
export function getRowOffset(
  slot: QueueSlot,
  drag: QueueDragState | null,
  m: QueueMetrics,
): number {
  if (!drag) return 0;
  const { from, target } = drag;
  if (slot.section === from.section && slot.index === from.index) return 0;

  if (from.section === target.section) {
    if (slot.section !== from.section) return 0;
    if (target.index < from.index && slot.index >= target.index && slot.index < from.index) {
      return ROW_HEIGHT;
    }
    if (target.index > from.index && slot.index > from.index && slot.index <= target.index) {
      return -ROW_HEIGHT;
    }
    return 0;
  }

  if (from.section === "upcoming" && target.section === "queue") {
    if (m.queueCount === 0) {
      return slot.section === "upcoming" && slot.index > from.index ? -ROW_HEIGHT : 0;
    }
    if (slot.section === "queue" && slot.index >= target.index) return ROW_HEIGHT;
    if (slot.section === "upcoming" && slot.index < from.index) return ROW_HEIGHT;
    return 0;
  }

  // from.section === "queue" && target.section === "upcoming"
  if (m.queueCount === 1) {
    return slot.section === "upcoming" && slot.index >= target.index ? ROW_HEIGHT : 0;
  }
  if (slot.section === "queue" && slot.index > from.index) return -ROW_HEIGHT;
  if (slot.section === "upcoming" && slot.index < target.index) return -ROW_HEIGHT;
  return 0;
}

function upcomingInsertedSlotY(m: QueueMetrics, index: number): number {
  const dividerOffset =
    m.firstAutoplayIndex >= 0 && index > m.firstAutoplayIndex ? AUTOPLAY_TOTAL : 0;
  return upcomingStartY(m) + index * ROW_HEIGHT + dividerOffset;
}

export function evaluateTargetState(
  from: QueueSlot,
  target: QueueSlot,
  m: QueueMetrics,
): QueueDragState {
  const { queueCount: qCount } = m;
  const faIdx = m.firstAutoplayIndex;
  let slotY = 0;
  let nextUpHeaderOffset = 0;
  let autoplayDividerOffset = 0;
  let showEmptyQueueUnderneath = false;

  if (from.section === target.section) {
    if (from.section === "queue") {
      slotY = queueRowY(target.index);
    } else {
      slotY =
        target.index < from.index
          ? upcomingInsertedSlotY(m, target.index)
          : upcomingRowY(m, target.index);
      if (faIdx >= 0) {
        if (target.index < from.index && faIdx >= target.index && faIdx <= from.index) {
          autoplayDividerOffset = ROW_HEIGHT;
        } else if (target.index > from.index && faIdx > from.index && faIdx <= target.index) {
          autoplayDividerOffset = -ROW_HEIGHT;
        }
      }
    }
  } else if (from.section === "upcoming" && target.section === "queue") {
    slotY = queueRowY(target.index);
    if (qCount === 0) {
      if (faIdx > from.index) autoplayDividerOffset = -ROW_HEIGHT;
    } else {
      nextUpHeaderOffset = ROW_HEIGHT;
      if (faIdx >= 0 && faIdx <= from.index) autoplayDividerOffset = ROW_HEIGHT;
    }
  } else {
    // from.section === "queue" && target.section === "upcoming"
    if (qCount === 1) {
      showEmptyQueueUnderneath = true;
      slotY = upcomingInsertedSlotY(m, target.index);
      if (faIdx >= 0 && faIdx >= target.index) autoplayDividerOffset = ROW_HEIGHT;
    } else {
      nextUpHeaderOffset = -ROW_HEIGHT;
      slotY = upcomingInsertedSlotY(m, target.index) - ROW_HEIGHT;
      if (faIdx >= 0 && faIdx < target.index) autoplayDividerOffset = -ROW_HEIGHT;
    }
  }

  return {
    from,
    target,
    slotY,
    nextUpHeaderOffset,
    autoplayDividerOffset,
    showEmptyQueueUnderneath,
  };
}

/**
 * O(1) computation of the active drag target and layout offsets for any list size.
 */
export function computeQueueDrag(
  from: QueueSlot,
  dy: number,
  m: QueueMetrics,
): QueueDragState {
  const fromY = slotBaseY(m, from);
  const fingerY = fromY + ROW_HEIGHT / 2 + dy;
  const targetCenterY = fingerY - ROW_HEIGHT / 2;

  const { queueCount: qCount, upcomingCount: uCount, firstAutoplayIndex: faIdx } = m;
  const maxQ = from.section === "queue" ? Math.max(0, qCount - 1) : qCount;

  // Closest candidate in "queue" (linear: slotY = i * ROW_HEIGHT)
  const candidates: QueueSlot[] = [
    { section: "queue", index: clamp(Math.round(targetCenterY / ROW_HEIGHT), 0, maxQ) },
  ];

  // Closest candidates in "upcoming" (piecewise linear across autoplay divider / from.index)
  if (uCount > 0) {
    const maxU = from.section === "upcoming" ? uCount - 1 : uCount;
    const shift = from.section === "queue" && qCount >= 2 ? -ROW_HEIGHT : 0;
    const baseNoDiv = upcomingStartY(m) + shift;
    const baseWithDiv = baseNoDiv + (faIdx >= 0 ? AUTOPLAY_TOTAL : 0);

    const idxNoDiv = clamp(Math.round((targetCenterY - baseNoDiv) / ROW_HEIGHT), 0, maxU);
    const idxWithDiv = clamp(Math.round((targetCenterY - baseWithDiv) / ROW_HEIGHT), 0, maxU);

    candidates.push({ section: "upcoming", index: idxNoDiv });
    if (idxWithDiv !== idxNoDiv) {
      candidates.push({ section: "upcoming", index: idxWithDiv });
    }
    if (faIdx >= 0 && faIdx <= maxU) {
      candidates.push({ section: "upcoming", index: faIdx });
    }
    if (from.section === "upcoming") {
      candidates.push(from);
    }
  }

  let best: QueueDragState | null = null;
  let bestDist = Infinity;

  for (const candidate of candidates) {
    const state = evaluateTargetState(from, candidate, m);
    const dist = Math.abs(state.slotY + ROW_HEIGHT / 2 - fingerY);
    if (dist < bestDist) {
      bestDist = dist;
      best = state;
    }
  }

  return best ?? evaluateTargetState(from, from, m);
}

/**
 * Returns the O(1) visible slice [start, end] (inclusive) of rows in a section for windowing,
 * plus the actively dragged index if it scrolled outside the viewport.
 */
export function getVisibleIndices(
  section: QueueSlot["section"],
  m: QueueMetrics,
  minY: number,
  maxY: number,
  dragFrom?: QueueSlot | null,
): number[] {
  const count = section === "queue" ? m.queueCount : m.upcomingCount;
  if (count <= 0) return [];

  let start: number;
  let end: number;

  if (section === "queue") {
    start = clamp(Math.floor(minY / ROW_HEIGHT), 0, count - 1);
    end = clamp(Math.ceil(maxY / ROW_HEIGHT), 0, count - 1);
  } else {
    const base = upcomingStartY(m);
    const div = m.firstAutoplayIndex >= 0 ? AUTOPLAY_TOTAL : 0;
    start = clamp(Math.floor((minY - base - div) / ROW_HEIGHT), 0, count - 1);
    end = clamp(Math.ceil((maxY - base) / ROW_HEIGHT), 0, count - 1);
  }

  const indices: number[] = [];
  const dragIdx = dragFrom?.section === section ? dragFrom.index : -1;

  if (dragIdx >= 0 && dragIdx < start) {
    indices.push(dragIdx);
  }
  for (let i = start; i <= end; i++) {
    indices.push(i);
  }
  if (dragIdx > end && dragIdx < count) {
    indices.push(dragIdx);
  }

  return indices;
}
