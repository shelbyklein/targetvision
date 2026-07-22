import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type McpTokenListItem = {
  id: number;
  label: string;
  tokenPrefix: string;
  createdByName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

type CreateMcpTokenResult = { token: string; item: McpTokenListItem; publicBaseUrl: string | null };

const MCP_TOKENS_KEY = ["admin", "mcp-tokens"] as const;

export function useMcpTokens() {
  return useQuery({
    queryKey: MCP_TOKENS_KEY,
    queryFn: () => customFetch<McpTokenListItem[]>("/api/admin/mcp-tokens"),
  });
}

export function useCreateMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) =>
      customFetch<CreateMcpTokenResult>("/api/admin/mcp-tokens", {
        method: "POST",
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MCP_TOKENS_KEY }),
  });
}

export function useDeleteMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ deleted: boolean }>(`/api/admin/mcp-tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MCP_TOKENS_KEY }),
  });
}
