/**
 * One animation-frame dispatch queue for the swarm stream.
 *
 * Inputs: the reducer dispatch and a stream of small actions.
 * Outputs: a dispatch function that applies every queued action once per animation
 * frame, plus cancel for unmount.
 * Invariants: ordering is preserved, a burst becomes one reducer pass, and the fallback
 * timer keeps tests and non-browser callers working without requestAnimationFrame.
 */

export interface BatchedDispatch<Action> {
  dispatch: (action: Action) => void;
  cancel: () => void;
}

interface FrameScheduler {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

function scheduler(): FrameScheduler {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return {
      request: (callback) => window.requestAnimationFrame(callback),
      cancel: (handle) => window.cancelAnimationFrame(handle),
    };
  }
  return {
    request: (callback) => setTimeout(callback, 16) as unknown as number,
    cancel: (handle) => clearTimeout(handle),
  };
}

/** Creates a batching dispatcher. Call `cancel` on unmount. */
export function createBatchedDispatch<Action>(
  dispatch: (action: Action) => void,
): BatchedDispatch<Action> {
  const frames = scheduler();
  let queue: Action[] = [];
  let handle: number | null = null;

  const flush = (): void => {
    handle = null;
    if (queue.length === 0) return;
    const pending = queue;
    queue = [];
    for (const action of pending) dispatch(action);
  };

  return {
    dispatch: (action) => {
      queue.push(action);
      if (handle === null) handle = frames.request(flush);
    },
    cancel: () => {
      queue = [];
      if (handle !== null) {
        frames.cancel(handle);
        handle = null;
      }
    },
  };
}
