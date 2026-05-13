import { useState, useEffect, useCallback } from "react";
import { useGetMe } from "@workspace/api-client-react";

const STORAGE_KEY_PREFIX = "showHiddenPhotos";

function getStorageKey(userId?: number): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

export function useShowHiddenPhotos() {
  const { data: me } = useGetMe();
  const userId = me?.id;

  const [showHidden, setShowHiddenState] = useState<boolean>(() => {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      return stored === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const key = getStorageKey(userId);
      const stored = localStorage.getItem(key);
      setShowHiddenState(stored === "true");
    } catch {
      setShowHiddenState(false);
    }
  }, [userId]);

  const setShowHidden = useCallback(
    (value: boolean) => {
      try {
        const key = getStorageKey(userId);
        if (value) {
          localStorage.setItem(key, "true");
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }
      setShowHiddenState(value);
    },
    [userId],
  );

  return { showHidden, setShowHidden };
}
