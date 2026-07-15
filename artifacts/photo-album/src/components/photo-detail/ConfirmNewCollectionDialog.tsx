import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmNewCollectionState = {
  suggestionId: number;
  name: string;
} | null;

export function ConfirmNewCollectionDialog({
  confirmNewCollection,
  setConfirmNewCollection,
  acceptingNewCollection,
  onAccept,
}: {
  confirmNewCollection: ConfirmNewCollectionState;
  setConfirmNewCollection: React.Dispatch<React.SetStateAction<ConfirmNewCollectionState>>;
  acceptingNewCollection: boolean;
  onAccept: (suggestionId: number, name: string) => void;
}) {
  return (
    <Dialog
      open={confirmNewCollection !== null}
      onOpenChange={(open) => { if (!open) setConfirmNewCollection(null); }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create new collection</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Edit the name before creating this collection.
        </p>
        <Input
          value={confirmNewCollection?.name ?? ""}
          onChange={(e) =>
            setConfirmNewCollection((prev) =>
              prev ? { ...prev, name: e.target.value } : prev
            )
          }
          placeholder="Collection name"
          data-testid="confirm-new-collection-name-input"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && confirmNewCollection?.name.trim()) {
              onAccept(
                confirmNewCollection.suggestionId,
                confirmNewCollection.name.trim(),
              );
            }
          }}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => setConfirmNewCollection(null)}
            disabled={acceptingNewCollection}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (confirmNewCollection?.name.trim()) {
                onAccept(
                  confirmNewCollection.suggestionId,
                  confirmNewCollection.name.trim(),
                );
              }
            }}
            disabled={acceptingNewCollection || !confirmNewCollection?.name.trim()}
            data-testid="confirm-new-collection-btn"
          >
            {acceptingNewCollection ? "Creating…" : "Create collection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
