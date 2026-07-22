import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMyOrganizations,
  useSwitchOrganization,
  type MyOrganization,
} from "@workspace/api-client-react";
import { useSession } from "@/lib/auth-client";
import { CreateOrgScreen } from "@/components/auth/CreateOrgScreen";
import { getActiveOrgId, setActiveOrgId } from "@/lib/active-org";

type OrgContextValue = {
  orgs: MyOrganization[];
  activeOrg: MyOrganization | null;
  isLoading: boolean;
  switchOrg: (id: number) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const orgsQuery = useMyOrganizations();
  const orgs = orgsQuery.data ?? [];
  const isLoading = orgsQuery.isLoading;
  const { mutate: persistSwitch } = useSwitchOrganization();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(() => getActiveOrgId());

  // Reconcile the stored active org with the user's actual memberships once they
  // load: keep it if still valid, else fall back to the first membership.
  useEffect(() => {
    if (isLoading) return;
    if (orgs.length === 0) {
      if (activeId !== null) setActiveId(null);
      setActiveOrgId(null);
      return;
    }
    const valid = activeId != null && orgs.some((o) => o.id === activeId);
    const resolved = valid ? activeId! : orgs[0].id;
    if (resolved !== activeId) setActiveId(resolved);
    if (getActiveOrgId() !== resolved) setActiveOrgId(resolved);
    // activeId is intentionally omitted: this only reconciles when the org list
    // changes, and switchOrg handles explicit user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs, isLoading]);

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === activeId) ?? null,
    [orgs, activeId],
  );

  function switchOrg(id: number): void {
    if (id === activeId) return;
    // Update the store first so in-flight and subsequent requests target the new
    // org, then persist the sticky choice and refetch everything for it.
    setActiveOrgId(id);
    setActiveId(id);
    persistSwitch(id);
    void queryClient.invalidateQueries();
  }

  // A signed-in user who belongs to no org yet (e.g. a fresh sign-up) must create
  // one before the app is usable — every tenant route would otherwise 403.
  if (session?.user && orgsQuery.isSuccess && orgs.length === 0) {
    return <CreateOrgScreen />;
  }

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, isLoading, switchOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within an OrgProvider");
  return ctx;
}
