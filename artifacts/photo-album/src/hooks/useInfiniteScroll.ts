import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to a sentinel element near the bottom of a list.
 * `onReachEnd` fires whenever that sentinel scrolls into view (a little before,
 * via rootMargin) while `enabled` is true — use it to reveal / fetch the next
 * page. Re-binds each render so `onReachEnd` always sees fresh state, and
 * disconnects when `enabled` is false (e.g. everything has been shown).
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onReachEnd: () => void,
  enabled: boolean,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onReachEnd();
      },
      // Start loading a bit before the sentinel is actually visible so the next
      // batch is ready by the time the user reaches it.
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onReachEnd, enabled]);

  return ref;
}
