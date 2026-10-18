import { useCallback, useRef } from "react";

/**
 * A function with a fixed identity that always calls the latest `fn`. It lets a memoized child (the map) keep its
 * props equal across renders without ever running a stale handler.
 */
export function useStableCallback<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: Args) => latest.current(...args), []);
}
