import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a callback ref to attach to a sentinel element near the bottom of a
 * list. `onReachEnd` fires when that sentinel scrolls into view (a little
 * before, via rootMargin) while `enabled` is true — use it to reveal / fetch
 * the next page.
 *
 * The observer is (re)created only when `enabled` changes or the sentinel
 * element itself mounts/unmounts — NOT on every render. Re-creating it each
 * render re-fires its initial callback while the sentinel is intersecting,
 * which cascades into loading every page at once when list items have little
 * height before their (lazy) images load.
 *
 * A callback ref (rather than a ref object read once in an effect) matters
 * when `enabled` turns true while the page is still showing a skeleton: the
 * sentinel mounts on a later render, and the observer must attach then.
 *
 * Guard against overlapping loads (e.g. `if (!isFetching) …`) inside
 * `onReachEnd` rather than by toggling `enabled`, so the observer isn't torn
 * down mid-fetch.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onReachEnd: () => void,
  enabled: boolean,
) {
  const callbackRef = useRef(onReachEnd);
  callbackRef.current = onReachEnd;

  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const enabledRef = useRef(enabled);

  const attach = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    const el = elementRef.current;
    if (!el || !enabledRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callbackRef.current();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  // Callback ref: re-attach whenever the sentinel element mounts or changes.
  const setRef = useCallback(
    (el: T | null) => {
      elementRef.current = el;
      attach();
    },
    [attach],
  );

  useEffect(() => {
    enabledRef.current = enabled;
    attach();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [enabled, attach]);

  return setRef;
}
