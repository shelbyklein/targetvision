import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Download, EyeOff, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function deriveFilename(url: string, fallbackId?: number): string {
  let extension = "jpg";
  let urlBase = "";
  try {
    const u = new URL(url, window.location.href);
    const lastSegment = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex > 0 && dotIndex < lastSegment.length - 1) {
      const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
      if (/^[a-z0-9]{2,5}$/.test(ext)) extension = ext;
      urlBase = lastSegment.slice(0, dotIndex);
    } else {
      urlBase = lastSegment;
    }
  } catch {
    // ignore
  }

  function sanitize(n: string): string {
    return n
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  const cleanedUrlBase = urlBase ? sanitize(urlBase) : "";
  const base = cleanedUrlBase || `photo-${fallbackId ?? "image"}`;
  return `${base}.${extension}`;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function PhotoActions({
  photoUrl,
  photoId,
  isHidden,
  canToggleHidden,
  canDelete,
  deleting,
  onToggleHidden,
  onDelete,
}: {
  photoUrl: string;
  photoId: number;
  isHidden: boolean;
  canToggleHidden: boolean;
  canDelete: boolean;
  deleting: boolean;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    const filename = deriveFilename(photoUrl, photoId);
    setDownloading(true);
    try {
      let isSameOrigin = true;
      try {
        const u = new URL(photoUrl, window.location.href);
        isSameOrigin = u.origin === window.location.origin;
      } catch {
        isSameOrigin = false;
      }

      if (isSameOrigin) {
        triggerDownload(photoUrl, filename);
        toast({ title: "Download started" });
        return;
      }

      const response = await fetch(photoUrl, { mode: "cors", credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        triggerDownload(objectUrl, filename);
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      toast({ title: "Download started" });
    } catch (err) {
      toast({
        title: "Failed to download photo",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 w-full"
        onClick={handleDownload}
        disabled={downloading}
        data-testid="download-photo-btn"
      >
        <Download className="h-4 w-4" />
        {downloading ? "Downloading..." : "Download"}
      </Button>

      {canToggleHidden && (
        <Button
          variant={isHidden ? "outline" : "outline"}
          size="sm"
          className="gap-2 w-full"
          onClick={onToggleHidden}
          data-testid="toggle-hidden-btn"
        >
          {isHidden ? (
            <>
              <Eye className="h-4 w-4" />
              Unhide Photo
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              Hide Photo
            </>
          )}
        </Button>
      )}

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2 w-full" data-testid="delete-photo-btn">
              <Trash2 className="h-4 w-4" />
              Delete Photo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The photo will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90" data-testid="confirm-delete-photo">
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
