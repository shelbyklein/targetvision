import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// Getting-started checklist signals (#148), derived server-side from real org
// data. `dismissed` is the per-user "don't show me this again" flag.
export type OnboardingStatus = {
  hasPhotos: boolean;
  hasAlbums: boolean;
  hasCollectionPhotos: boolean;
  hasSmartCollection: boolean;
  hasProject: boolean;
  hasCollectionTag: boolean;
  hasTaggedPerson: boolean;
  hasAttribution: boolean;
  hasMcpToken: boolean;
  aiConfigured: boolean;
  aiAnalysisComplete: boolean;
  memberCount: number;
  invitedTeammate: boolean;
  dismissed: boolean;
};

const ONBOARDING_STATUS_KEY = ["onboarding", "status"] as const;

export function useOnboardingStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => customFetch<OnboardingStatus>("/api/onboarding/status"),
    enabled: options?.enabled ?? true,
  });
}

// Dismiss the checklist for the current user (persists across devices).
export function useDismissOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>("/api/onboarding/dismiss", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY }),
  });
}
