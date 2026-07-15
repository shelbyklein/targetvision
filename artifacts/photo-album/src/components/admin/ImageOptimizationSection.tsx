import {
  useImageOptimizationStatus,
  useUpdateImageOptimizationSettings,
} from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ImageOptimizationSection() {
  const { toast } = useToast();
  const { data: status, isLoading } = useImageOptimizationStatus();
  const { mutate: updateSettings, isPending: updating } = useUpdateImageOptimizationSettings();

  function handleToggle(enabled: boolean) {
    updateSettings(
      { enabled },
      {
        onSuccess: () =>
          toast({ title: enabled ? "Image optimization enabled" : "Image optimization disabled" }),
        onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="image-optimization-section">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <FileImage className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Image Optimization</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Convert newly-uploaded originals to WebP to save storage, preserving EXIF and orientation.
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Optimize originals on upload</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status
                ? `WebP quality ${status.quality} · downscale over ${status.maxEdge.toLocaleString()}px · already-efficient files left as-is`
                : "…"}
            </p>
          </div>
          <Switch
            checked={status?.enabled ?? false}
            onCheckedChange={handleToggle}
            disabled={isLoading || updating}
            data-testid="image-optimization-enabled-switch"
          />
        </div>
      </div>
    </div>
  );
}
