import { z } from "zod";
import { GetPhotoResponse } from "./generated/api";

export const ListAlbumPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const ListPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const SearchPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const CheckDuplicatesBody = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
    })
  ),
});

export const CheckDuplicatesResponse = z.object({
  duplicates: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      photoId: z.number(),
    })
  ),
});

export const BackfillThumbnailsResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const BackfillThumbnailsStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillExifDatesStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillExifDatesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const BackfillContentHashesStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillContentHashesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

// Admin-managed MCP gateway tokens. The raw token is only present in the
// create response; list/get never expose it.
export const McpTokenListItem = z.object({
  id: z.number(),
  label: z.string(),
  tokenPrefix: z.string(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export const ListMcpTokensResponse = z.array(McpTokenListItem);
export const CreateMcpTokenBody = z.object({ label: z.string().trim().min(1).max(80) });
export const CreateMcpTokenResponse = z.object({
  token: z.string(),
  item: McpTokenListItem,
  // Public MCP gateway base URL (from MCP_PUBLIC_URL) so the one-time reveal
  // can show a ready-to-paste connector URL; null if the gateway isn't public.
  publicBaseUrl: z.string().nullable(),
});
export const DeleteMcpTokenResponse = z.object({ deleted: z.boolean() });

// Aggregated at-a-glance counts for the admin hub cards. One cheap endpoint
// so the hub doesn't regress into per-section loading (#76).
export const AdminHubStatusResponse = z.object({
  aiAnalysisPending: z.number(),
  embeddingsPending: z.number(),
  thumbnailsMissing: z.number(),
  capturedDatesMissing: z.number(),
  duplicateGroups: z.number(),
});

export const BackfillDimensionsStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillDimensionsResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const PerceptualHashBackfillStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillPerceptualHashesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

// Shape matches the generated DuplicatePhoto type so the admin UI can reuse the
// same photo card for near-duplicate groups.
const NearDuplicatePhotoSchema = z.object({
  id: z.number(),
  albumId: z.number(),
  albumTitle: z.string().nullable(),
  filename: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
  isAlbumCover: z.boolean(),
  collectionCount: z.number(),
});

export const NearDuplicateIndexStatusResponse = z.object({
  pairCount: z.number(),
  hashedPhotos: z.number(),
});

export const RebuildNearDuplicateIndexResponse = z.object({
  photos: z.number(),
  pairs: z.number(),
});

export const NearDuplicatePhotoGroupsResponse = z.object({
  threshold: z.number(),
  totalGroups: z.number(),
  hasMore: z.boolean(),
  groups: z.array(
    z.object({
      key: z.string(),
      distance: z.number(),
      photos: z.array(NearDuplicatePhotoSchema),
    }),
  ),
});

export const BackfillAiAnalysisStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillAiAnalysisBody = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

export const BackfillAiAnalysisResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const AiBackfillRun = z.object({
  id: z.number(),
  trigger: z.enum(["manual", "automatic"]),
  requestedLimit: z.number().nullable(),
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
  createdAt: z.string(),
});

export const ListAiBackfillRunsResponse = z.array(AiBackfillRun);

export const AiAutoBackfillSettings = z.object({
  enabled: z.boolean(),
  batchSize: z.number().int().positive(),
});

export const GetAiAutoBackfillSettingsResponse = AiAutoBackfillSettings;

export const UpdateAiAutoBackfillSettingsBody = z.object({
  enabled: z.boolean().optional(),
  batchSize: z.number().int().positive().max(1000).optional(),
});

export const UpdateAiAutoBackfillSettingsResponse = AiAutoBackfillSettings;

// --- Image embeddings (Vertex AI) ---
export const EmbeddingStatusResponse = z.object({
  enabled: z.boolean(),
  projectConfigured: z.boolean(),
  credentialsConfigured: z.boolean(),
  model: z.string(),
  location: z.string(),
  embeddedCount: z.number(),
  missingCount: z.number(),
});

export const UpdateEmbeddingSettingsBody = z.object({
  enabled: z.boolean(),
});

export const BackfillEmbeddingsBody = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

export const BackfillEmbeddingsResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  failed: z.number(),
});

// --- Image optimization (WebP on import) ---
export const ImageOptimizationStatusResponse = z.object({
  enabled: z.boolean(),
  quality: z.number(),
  maxEdge: z.number(),
});

export const UpdateImageOptimizationSettingsBody = z.object({
  enabled: z.boolean(),
});

// --- Organizations (multi-tenant context, issue #113) ---
// One org the current user belongs to, with their role in it. The active org is
// selected via the X-Organization-Id header (see requireOrg); these endpoints
// let the client discover which orgs it may pick and persist the sticky choice.
export const MyOrganization = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  role: z.string(), // "owner" | "admin" | "member"
});

export const ListMyOrganizationsResponse = z.array(MyOrganization);

export const SwitchOrganizationBody = z.object({
  organizationId: z.number().int(),
});

export const SwitchOrganizationResponse = MyOrganization;

// Create a new organization; the caller becomes its owner. Slug is derived
// server-side from the name (uniqueness handled there).
export const CreateOrganizationBody = z.object({
  name: z.string().trim().min(1).max(80),
});

export const CreateOrganizationResponse = MyOrganization;

// --- Org member + invite management (Phase 4c) ---
const OrgRole = z.enum(["owner", "admin", "member"]);

export const OrgMember = z.object({
  userId: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
});
export const ListOrgMembersResponse = z.array(OrgMember);

export const UpdateOrgMemberRoleBody = z.object({ role: OrgRole });

export const OrgInvite = z.object({
  id: z.number(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});
export const ListOrgInvitesResponse = z.array(OrgInvite);

export const CreateOrgInviteBody = z.object({
  email: z.string().trim().email().max(255),
  role: OrgRole.optional(),
});
export const CreateOrgInviteResponse = OrgInvite;

// --- Org settings / info (Phase 4d) ---
export const OrgDetailsResponse = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  role: z.string(), // the caller's role in this org
  memberCount: z.number(),
});

export const UpdateOrgBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

// --- Billing / subscription (issue #118) ---
export const BillingStatusResponse = z.object({
  plan: z.string(),
  planLabel: z.string(),
  capBytes: z.number().nullable(), // null = unlimited
  usageBytes: z.number(),
  ratio: z.number(),
  nearLimit: z.boolean(),
  overLimit: z.boolean(),
  status: z.string(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  hasStripeCustomer: z.boolean(),
  canManage: z.boolean(),
});

export const CheckoutSessionResponse = z.object({ url: z.string() });
export const PortalSessionResponse = z.object({ url: z.string() });

// Platform-admin override to set an org's plan directly (Enterprise / manual).
export const SetOrgPlanBody = z.object({
  organizationId: z.number().int(),
  plan: z.enum(["free", "pro", "enterprise"]),
});

// --- Platform superadmin (issue #120) ---
// One row per organization in the platform-admin overview, with enough to
// manage plans and spot growth without entering the org.
export const AdminOrganizationSummary = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  plan: z.string(),
  subscriptionStatus: z.string(),
  memberCount: z.number(),
  photoCount: z.number(),
  usageBytes: z.number(),
  capBytes: z.number().nullable(), // null = unlimited
  createdAt: z.string(),
  // The calling platform admin's own membership in this org (null if none) —
  // drives the "Join as admin" vs "Member" affordance.
  myRole: z.string().nullable(),
  members: z.array(
    z.object({
      userId: z.number(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
    }),
  ),
});
export const AdminOrganizationsResponse = z.array(AdminOrganizationSummary);

export const JoinOrganizationResponse = z.object({
  organizationId: z.number(),
  role: z.string(),
  alreadyMember: z.boolean(),
});
