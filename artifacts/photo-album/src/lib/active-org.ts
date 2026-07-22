import { setActiveOrgIdGetter } from "@workspace/api-client-react";

// The active organization id (issue #113) is persisted in localStorage so it
// survives reloads, and read synchronously by the API client on every request
// (see setActiveOrgIdGetter → X-Organization-Id). OrgProvider keeps it in sync
// with the user's actual memberships.
const KEY = "tv.activeOrgId";

export function getActiveOrgId(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function setActiveOrgId(id: number | null): void {
  if (typeof localStorage === "undefined") return;
  if (id == null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, String(id));
}

// Register once at module load so every customFetch call attaches the header.
setActiveOrgIdGetter(() => getActiveOrgId());
