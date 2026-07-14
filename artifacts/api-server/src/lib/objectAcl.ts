import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// TargetVision serves photos as internal-team content: any signed-in member may
// read any object (see the GET /storage/objects route, which gates on auth only).
// The only ACL fact still consulted is an object's public/private visibility,
// used by downloadObject to choose the Cache-Control header. Per-owner/per-object
// read enforcement is intentionally not implemented; if it is ever needed,
// reintroduce a canAccessObject check in the storage route.
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  return JSON.parse(raw as string);
}
