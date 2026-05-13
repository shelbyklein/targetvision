import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export const getListCollectionTagsQueryKey = (id: number) =>
  ["listCollectionTags", id] as const;

export function useListCollectionTags(id: number) {
  return useQuery({
    queryKey: getListCollectionTagsQueryKey(id),
    queryFn: () => customFetch<string[]>(`/api/collections/${id}/tags`),
    enabled: !!id,
  });
}

export function useAddCollectionTag() {
  return useMutation({
    mutationFn: ({ id, tagName }: { id: number; tagName: string }) =>
      customFetch<void>(`/api/collections/${id}/tags`, {
        method: "POST",
        body: JSON.stringify({ tagName }),
      }),
  });
}

export function useRemoveCollectionTag() {
  return useMutation({
    mutationFn: ({ id, tagName }: { id: number; tagName: string }) =>
      customFetch<void>(
        `/api/collections/${id}/tags/${encodeURIComponent(tagName)}`,
        { method: "DELETE" },
      ),
  });
}
