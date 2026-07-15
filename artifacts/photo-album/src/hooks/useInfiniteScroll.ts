import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to a sentinel element near the bottom of a list.
 * `onReachEnd` fires when that sentinel scrolls into view (a little before, via
 * rootMargin) while `enabled` is true — use it to reveal / fetch the next page.
 *
 * The callback is held in a ref so the IntersectionObserver is created only when
 * `enabled` changes, NOT on every render. That's important: re-creating the
 * observer each render re-fires its initial callback while the sentinel is
 * intersecting, which cascades into loading every page at once when list items
 * have little height before their (lazy) images load. With a persistent
 * observer, the callback fires once per genuine enter transition.
 *
 * Guard against overlapping loads (e.g. `if (!isFetching) …`) inside `onReachEnd`
 * rather than by toggling `enabled`, so the observer isn't torn down mid-fetch.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onReachEnd: () => void,
  enabled: boolean,
) {
  const ref = useRef<T | null>(null);
  const callbackRef = useRef(onReachEnd);
  callbackRef.current = onReachEnd;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callbackRef.current();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
