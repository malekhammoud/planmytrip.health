import { afterEach, describe, expect, it, vi } from "vitest";
import { createBatchedDispatch } from "./swarmBatch";

afterEach(() => {
  vi.useRealTimers();
});

describe("createBatchedDispatch", () => {
  it("applies a burst in order once the frame fallback fires", () => {
    vi.useFakeTimers();
    const actions: number[] = [];
    const batcher = createBatchedDispatch<number>((action) => actions.push(action));
    batcher.dispatch(1);
    batcher.dispatch(2);
    batcher.dispatch(3);
    expect(actions).toEqual([]);
    vi.advanceTimersByTime(16);
    expect(actions).toEqual([1, 2, 3]);
    batcher.cancel();
  });

  it("drops queued actions on cancel and can run again", () => {
    vi.useFakeTimers();
    const actions: number[] = [];
    const batcher = createBatchedDispatch<number>((action) => actions.push(action));
    batcher.dispatch(1);
    batcher.cancel();
    vi.advanceTimersByTime(20);
    expect(actions).toEqual([]);
    batcher.dispatch(2);
    vi.advanceTimersByTime(16);
    expect(actions).toEqual([2]);
    batcher.cancel();
  });
});
