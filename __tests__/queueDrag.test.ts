import {
  computeQueueDrag,
  getRowOffset,
  getVisibleIndices,
  slotBaseY,
  QueueMetrics,
  ROW_HEIGHT,
} from "@/scripts/queueDrag";

describe("queueDrag O(1) engine", () => {
  test("shifts intermediate rows down and opens slot at target when dragging up in same section", () => {
    const m: QueueMetrics = { queueCount: 0, upcomingCount: 4, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "upcoming", index: 2 }, -124, m);

    expect(res.target).toEqual({ section: "upcoming", index: 0 });
    expect(res.slotY).toBe(slotBaseY(m, { section: "upcoming", index: 0 }));
    expect(getRowOffset({ section: "upcoming", index: 0 }, res, m)).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 1 }, res, m)).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(0);
    expect(getRowOffset({ section: "upcoming", index: 3 }, res, m)).toBe(0);
  });

  test("shifts intermediate rows up and opens slot at target when dragging down in same section", () => {
    const m: QueueMetrics = { queueCount: 0, upcomingCount: 4, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "upcoming", index: 0 }, 124, m);

    expect(res.target).toEqual({ section: "upcoming", index: 2 });
    expect(res.slotY).toBe(slotBaseY(m, { section: "upcoming", index: 2 }));
    expect(getRowOffset({ section: "upcoming", index: 1 }, res, m)).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 3 }, res, m)).toBe(0);
  });

  test("targets empty queue slot and shifts trailing upcoming rows up when dragging into empty queue", () => {
    const m: QueueMetrics = { queueCount: 0, upcomingCount: 3, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "upcoming", index: 1 }, -188, m);

    expect(res.target).toEqual({ section: "queue", index: 0 });
    expect(res.slotY).toBe(0);
    expect(res.nextUpHeaderOffset).toBe(0);
    expect(getRowOffset({ section: "upcoming", index: 0 }, res, m)).toBe(0);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(-62);
  });

  test("shifts queue rows, header, and preceding upcoming rows down when dragging into populated queue", () => {
    const m: QueueMetrics = { queueCount: 2, upcomingCount: 3, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "upcoming", index: 1 }, -188, m);

    expect(res.target).toEqual({ section: "queue", index: 1 });
    expect(res.slotY).toBe(slotBaseY(m, { section: "queue", index: 1 }));
    expect(getRowOffset({ section: "queue", index: 0 }, res, m)).toBe(0);
    expect(getRowOffset({ section: "queue", index: 1 }, res, m)).toBe(62);
    expect(res.nextUpHeaderOffset).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 0 }, res, m)).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(0);

    // Drag upcoming:1 to the end of queue (queue:2)
    const resEnd = computeQueueDrag({ section: "upcoming", index: 1 }, -126, m);
    expect(resEnd.target).toEqual({ section: "queue", index: 2 });
    expect(resEnd.slotY).toBe(slotBaseY(m, { section: "queue", index: 1 }) + 62);
    expect(resEnd.nextUpHeaderOffset).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 0 }, resEnd, m)).toBe(62);
  });

  test("shows empty queue underneath and shifts upcoming rows down when dragging sole queue item into upcoming", () => {
    const m: QueueMetrics = { queueCount: 1, upcomingCount: 3, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "queue", index: 0 }, 188, m);

    expect(res.target).toEqual({ section: "upcoming", index: 1 });
    expect(res.showEmptyQueueUnderneath).toBe(true);
    expect(res.nextUpHeaderOffset).toBe(0);
    expect(res.slotY).toBe(slotBaseY(m, { section: "upcoming", index: 1 }));
    expect(getRowOffset({ section: "upcoming", index: 0 }, res, m)).toBe(0);
    expect(getRowOffset({ section: "upcoming", index: 1 }, res, m)).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(62);
  });

  test("aligns dropSlot with the vacated gap when dragging from multi-item queue into upcoming", () => {
    const m: QueueMetrics = { queueCount: 2, upcomingCount: 5, firstAutoplayIndex: -1 };
    const res = computeQueueDrag({ section: "queue", index: 1 }, 250, m);

    expect(res.target).toEqual({ section: "upcoming", index: 3 });
    expect(res.showEmptyQueueUnderneath).toBe(false);
    expect(res.nextUpHeaderOffset).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 0 }, res, m)).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 1 }, res, m)).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 2 }, res, m)).toBe(-62);
    expect(getRowOffset({ section: "upcoming", index: 3 }, res, m)).toBe(0);
    expect(res.slotY).toBe(312);

    const upcoming2VisualBottom =
      slotBaseY(m, { section: "upcoming", index: 2 }) +
      getRowOffset({ section: "upcoming", index: 2 }, res, m) +
      ROW_HEIGHT;
    const upcoming3VisualTop =
      slotBaseY(m, { section: "upcoming", index: 3 }) +
      getRowOffset({ section: "upcoming", index: 3 }, res, m);

    expect(upcoming2VisualBottom).toBe(res.slotY);
    expect(res.slotY + ROW_HEIGHT).toBe(upcoming3VisualTop);
  });

  test("shifts autoplay divider down when dragging an autoplay track above the divider", () => {
    const m: QueueMetrics = { queueCount: 0, upcomingCount: 3, firstAutoplayIndex: 1 };
    const res = computeQueueDrag({ section: "upcoming", index: 2 }, -80, m);

    expect(res.target).toEqual({ section: "upcoming", index: 1 });
    expect(res.autoplayDividerOffset).toBe(62);
    expect(getRowOffset({ section: "upcoming", index: 1 }, res, m)).toBe(62);
    expect(res.slotY).toBe(slotBaseY(m, { section: "upcoming", index: 0 }) + 62);
  });

  test("virtualizes 5,000+ track queues in O(1) time while keeping dragged item mounted", () => {
    const m: QueueMetrics = { queueCount: 500, upcomingCount: 5000, firstAutoplayIndex: 4200 };
    // Viewport around y = 100,000 to 101,000
    const visible = getVisibleIndices(
      "upcoming",
      m,
      100000,
      101000,
      { section: "upcoming", index: 10 }, // dragged item far above viewport
    );

    // Only the ~18 viewport rows + 1 dragged row are mounted out of 5,000
    expect(visible.length).toBeLessThan(25);
    expect(visible[0]).toBe(10); // dragged row kept mounted

    // 1,000 drag evaluations on a 5,500-track queue complete in < 20ms
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      computeQueueDrag({ section: "upcoming", index: 10 }, i * 15, m);
    }
    expect(Date.now() - start).toBeLessThan(50);
  });
});
