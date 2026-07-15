import type { SuggestedCollection, SuggestedNewCollection } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, X, Loader2, RefreshCw, Pencil } from "lucide-react";

export function AiDescriptionPanel({
  aiDescription,
  createdAt,
  suggestedCollections,
  suggestedNewCollections,
  canEditDescription,
  canRerunAnalysis,
  editingDescription,
  descriptionDraft,
  setDescriptionDraft,
  savingDescription,
  rerunning,
  onStartEdit,
  onCancelEdit,
  onSave,
  onRerun,
  onAcceptSuggestion,
  onDismissSuggestion,
  onCreateNewCollection,
  onDismissNewCollectionSuggestion,
}: {
  aiDescription?: string | null;
  createdAt: string;
  suggestedCollections?: SuggestedCollection[];
  suggestedNewCollections?: SuggestedNewCollection[];
  canEditDescription: boolean;
  canRerunAnalysis: boolean;
  editingDescription: boolean;
  descriptionDraft: string;
  setDescriptionDraft: (value: string) => void;
  savingDescription: boolean;
  rerunning: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onRerun: () => void;
  onAcceptSuggestion: (collectionId: number) => void;
  onDismissSuggestion: (collectionId: number) => void;
  onCreateNewCollection: (suggestion: { suggestionId: number; name: string }) => void;
  onDismissNewCollectionSuggestion: (suggestionId: number) => void;
}) {
  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2"
      data-testid="ai-description-block"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AI description
        </div>
        <div className="flex items-center gap-2">
          {canEditDescription && !editingDescription && (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="edit-description-btn"
              title="Edit description"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {canRerunAnalysis && !editingDescription && (
            <button
              type="button"
              onClick={onRerun}
              disabled={rerunning}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="rerun-analysis-btn"
              title="Re-run AI analysis"
            >
              {rerunning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regenerate
            </button>
          )}
        </div>
      </div>
      {editingDescription ? (
        <div className="space-y-2" data-testid="description-edit-form">
          <Textarea
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            placeholder="Enter a description…"
            className="text-sm min-h-[80px] resize-none"
            disabled={savingDescription}
            autoFocus
            data-testid="description-textarea"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              onClick={onSave}
              disabled={savingDescription}
              data-testid="save-description-btn"
            >
              {savingDescription ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving…</>
              ) : (
                "Save"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs px-3"
              onClick={onCancelEdit}
              disabled={savingDescription}
              data-testid="cancel-description-btn"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : aiDescription ? (
        <p className="text-sm text-foreground" data-testid="ai-description-text">
          {aiDescription}
        </p>
      ) : createdAt && Date.now() - new Date(createdAt).getTime() < 60_000 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="ai-description-loading">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analyzing photo…
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">No description available.</p>
      )}
      {suggestedCollections && suggestedCollections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Suggested collections
          </p>
          <div className="flex flex-wrap gap-1.5" data-testid="suggested-collections">
            {suggestedCollections.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-rose-50 dark:bg-rose-950 pl-2.5 pr-1 py-0.5 text-xs"
                data-testid={`suggested-collection-${s.id}`}
              >
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-foreground">{s.title}</span>
                <button
                  onClick={() => onAcceptSuggestion(s.id)}
                  className="rounded-full p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900 text-primary"
                  aria-label="Accept suggestion"
                  data-testid={`accept-suggestion-${s.id}`}
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDismissSuggestion(s.id)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/15 text-muted-foreground"
                  aria-label="Dismiss suggestion"
                  data-testid={`dismiss-suggestion-${s.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {suggestedNewCollections && suggestedNewCollections.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Create new collection
          </p>
          <div className="flex flex-wrap gap-1.5" data-testid="suggested-new-collections">
            {suggestedNewCollections.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-100 dark:bg-emerald-900 pl-2.5 pr-1 py-0.5 text-xs"
                data-testid={`suggested-new-collection-${s.id}`}
              >
                <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-foreground">{s.suggestedName}</span>
                <button
                  onClick={() => onCreateNewCollection({ suggestionId: s.id, name: s.suggestedName })}
                  className="rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-600 dark:text-emerald-400"
                  aria-label="Create collection and add photo"
                  title="Create this collection and add photo"
                  data-testid={`accept-new-collection-suggestion-${s.id}`}
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDismissNewCollectionSuggestion(s.id)}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/15 text-muted-foreground"
                  aria-label="Dismiss suggestion"
                  data-testid={`dismiss-new-collection-suggestion-${s.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
