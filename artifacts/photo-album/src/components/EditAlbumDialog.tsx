import { useState } from "react";
import { useUpdateAlbum, useListAlbums } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { collectFolders } from "@/pages/albums";

// Edit an album's details — title, description, event date, and folder (#149).
// The folder input suggests existing labels; setting it moves the album into
// that group on the Albums page, clearing it ungroups it.
export function EditAlbumDialog({
  albumId,
  title,
  description,
  eventDate,
  folder,
  onSaved,
}: {
  albumId: number;
  title: string;
  description: string | null | undefined;
  eventDate: string | null | undefined;
  folder: string | null | undefined;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftEventDate, setDraftEventDate] = useState(eventDate ?? "");
  const [draftFolder, setDraftFolder] = useState(folder ?? "");
  const { mutate: updateAlbum, isPending } = useUpdateAlbum();
  const { data: albums } = useListAlbums();
  const { toast } = useToast();
  const folderSuggestions = collectFolders(albums);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Re-seed drafts from the latest props each time the dialog opens.
      setDraftTitle(title);
      setDraftDescription(description ?? "");
      setDraftEventDate(eventDate ?? "");
      setDraftFolder(folder ?? "");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    updateAlbum(
      {
        id: albumId,
        data: {
          title: draftTitle.trim(),
          description: draftDescription.trim(),
          eventDate: draftEventDate || null,
          folder: draftFolder.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          onSaved();
          toast({ title: "Album updated" });
        },
        onError: () => toast({ title: "Failed to update album", variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title="Edit album"
          aria-label="Edit album"
          data-testid="edit-album-btn"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Album</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-album-title">Title *</Label>
            <Input
              id="edit-album-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              required
              data-testid="edit-album-title-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-album-desc">Description</Label>
            <Textarea
              id="edit-album-desc"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={3}
              data-testid="edit-album-desc-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-album-date">Event Date</Label>
            <Input
              id="edit-album-date"
              type="date"
              value={draftEventDate}
              onChange={(e) => setDraftEventDate(e.target.value)}
              data-testid="edit-album-date-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-album-folder">Folder</Label>
            <Input
              id="edit-album-folder"
              value={draftFolder}
              onChange={(e) => setDraftFolder(e.target.value)}
              placeholder='Optional — e.g. "2026"'
              list="edit-album-folder-options"
              data-testid="edit-album-folder-input"
            />
            <datalist id="edit-album-folder-options">
              {folderSuggestions.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !draftTitle.trim()} data-testid="edit-album-submit">
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
