import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlbumOption {
  id: number;
  title: string;
}

interface DestinationPanelProps {
  destType: "new" | "existing";
  setDestType: Dispatch<SetStateAction<"new" | "existing">>;
  newAlbumName: string;
  setNewAlbumName: Dispatch<SetStateAction<string>>;
  existingAlbumId: number | undefined;
  setExistingAlbumId: Dispatch<SetStateAction<number | undefined>>;
  albumSearch: string;
  setAlbumSearch: Dispatch<SetStateAction<string>>;
  albums: AlbumOption[] | undefined;
  filteredAlbums: AlbumOption[] | undefined;
}

export function DestinationPanel({
  destType,
  setDestType,
  newAlbumName,
  setNewAlbumName,
  existingAlbumId,
  setExistingAlbumId,
  albumSearch,
  setAlbumSearch,
  albums,
  filteredAlbums,
}: DestinationPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">Upload destination</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setDestType("new"); setExistingAlbumId(undefined); setAlbumSearch(""); }}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            destType === "new"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
          )}
        >
          New album
        </button>
        <button
          type="button"
          onClick={() => { setDestType("existing"); setNewAlbumName(""); }}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            destType === "existing"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
          )}
        >
          Existing album
        </button>
      </div>

      {destType === "new" && (
        <Input
          value={newAlbumName}
          onChange={(e) => setNewAlbumName(e.target.value)}
          placeholder="Album name"
          className="h-9 text-sm"
        />
      )}

      {destType === "existing" && (
        <div className="space-y-1.5">
          <Input
            value={albumSearch}
            onChange={(e) => { setAlbumSearch(e.target.value); setExistingAlbumId(undefined); }}
            placeholder="Search albums…"
            className="h-9 text-sm"
            autoFocus
          />
          {filteredAlbums && filteredAlbums.length > 0 && !existingAlbumId && (
            <div className="rounded-lg border border-border bg-popover max-h-48 overflow-y-auto divide-y divide-border shadow-sm">
              {filteredAlbums.map((album) => (
                <button
                  key={album.id}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors"
                  onClick={() => { setExistingAlbumId(album.id); setAlbumSearch(album.title); }}
                >
                  {album.title}
                </button>
              ))}
            </div>
          )}
          {existingAlbumId && (
            <p className="text-sm text-primary font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {albums?.find((a) => a.id === existingAlbumId)?.title}
              <button
                className="text-muted-foreground hover:text-foreground ml-1"
                onClick={() => { setExistingAlbumId(undefined); setAlbumSearch(""); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
