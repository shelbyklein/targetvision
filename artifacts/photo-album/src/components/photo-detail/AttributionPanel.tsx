import {
  useListAttributionTags,
  useAddPhotoAttributionTag,
  useRemovePhotoAttributionTag,
  getGetPhotoQueryKey,
} from "@workspace/api-client-react";
import type { AttributionTag } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Copyright, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Usage-rights pills for the photo page: toggle which attribution tags this
// photo is cleared for. Mirrors the lightbox sidebar section in theme colors.
export function AttributionPanel({
  photoId,
  photoTags,
}: {
  photoId: number;
  photoTags?: AttributionTag[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: allTags } = useListAttributionTags();
  const { mutate: addTag, isPending: adding } = useAddPhotoAttributionTag();
  const { mutate: removeTag, isPending: removing } = useRemovePhotoAttributionTag();

  if (!allTags || allTags.length === 0) return null;

  const current = photoTags ?? [];

  function handleToggle(tagId: number, tagName: string, isIn: boolean) {
    const opts = {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
        toast({ title: isIn ? `Removed "${tagName}"` : `Cleared for "${tagName}"` });
      },
      onError: () => toast({ title: "Failed to update attribution", variant: "destructive" }),
    };
    if (isIn) removeTag({ id: photoId, tagId }, opts);
    else addTag({ id: photoId, data: { tagId } }, opts);
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Copyright className="h-3.5 w-3.5" />
        Attribution
      </Label>
      <div className="flex flex-wrap gap-1.5" data-testid="photo-attribution-pills">
        {allTags.map((tag) => {
          const isIn = current.some((t) => t.id === tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleToggle(tag.id, tag.name, isIn)}
              disabled={adding || removing}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50",
                isIn
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/85"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
              data-testid={`photo-attribution-pill-${tag.id}`}
              aria-label={isIn ? `Remove ${tag.name} clearance` : `Clear for ${tag.name}`}
              aria-pressed={isIn}
            >
              {isIn ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0" />}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
