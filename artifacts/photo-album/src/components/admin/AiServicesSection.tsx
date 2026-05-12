import { useState } from "react";
import {
  useGetAiSettings,
  useUpdateAiSettings,
  useSetAiProviderKey,
  useClearAiProviderKey,
  getGetAiSettingsQueryKey,
  type AiSettings,
  type AiProviderInfo,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, KeyRound, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProviderId = "openai" | "anthropic" | "gemini";

const PROVIDER_ORDER: ProviderId[] = ["openai", "anthropic", "gemini"];

export function AiServicesSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetAiSettings();
  const { mutate: updateSettings, isPending: updating } = useUpdateAiSettings();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetAiSettingsQueryKey() });

  function handleToggleEnabled(enabled: boolean) {
    updateSettings(
      { data: { enabled } },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: enabled ? "AI photo analysis turned on" : "AI photo analysis turned off",
          });
        },
        onError: () =>
          toast({ title: "Failed to update settings", variant: "destructive" }),
      },
    );
  }

  function handleSetActive(activeProvider: ProviderId) {
    updateSettings(
      { data: { activeProvider } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Active provider set to ${activeProvider}` });
        },
        onError: () =>
          toast({ title: "Failed to update active provider", variant: "destructive" }),
      },
    );
  }

  if (isLoading || !settings) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">AI Services</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Loading…</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden"
      data-testid="ai-services-section"
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">AI Services</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which AI service describes uploaded photos and suggests collections.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/50 px-4 py-3">
          <div>
            <Label htmlFor="ai-enabled" className="text-sm font-medium">
              AI photo analysis enabled
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When off, uploads skip AI analysis entirely.
            </p>
          </div>
          <Switch
            id="ai-enabled"
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={updating}
            data-testid="ai-enabled-switch"
          />
        </div>

        {settings.enabled && !settings.hasUsableActive && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-900 dark:text-amber-200">
              The active provider has no API key and no built-in fallback. New uploads
              will be saved without AI descriptions until you add a key below.
            </p>
          </div>
        )}

        <RadioGroup
          value={settings.activeProvider}
          onValueChange={(v) => handleSetActive(v as ProviderId)}
          className="space-y-3"
          disabled={updating || !settings.enabled}
        >
          {PROVIDER_ORDER.map((id) => (
            <ProviderCard
              key={id}
              provider={settings.providers[id]}
              isActive={settings.activeProvider === id}
              disabled={!settings.enabled}
            />
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isActive,
  disabled,
}: {
  provider: AiProviderInfo;
  isActive: boolean;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [keyInput, setKeyInput] = useState("");
  const { mutate: saveKey, isPending: saving } = useSetAiProviderKey();
  const { mutate: clearKey, isPending: clearing } = useClearAiProviderKey();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetAiSettingsQueryKey() });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const apiKey = keyInput.trim();
    if (apiKey.length < 4) return;
    saveKey(
      { provider: provider.id, data: { apiKey } },
      {
        onSuccess: () => {
          setKeyInput("");
          invalidate();
          toast({ title: `${provider.label} key saved` });
        },
        onError: () =>
          toast({ title: `Failed to save ${provider.label} key`, variant: "destructive" }),
      },
    );
  }

  function handleClear() {
    clearKey(
      { provider: provider.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `${provider.label} key cleared` });
        },
        onError: () =>
          toast({ title: `Failed to clear ${provider.label} key`, variant: "destructive" }),
      },
    );
  }

  return (
    <div
      className={`rounded-lg border bg-background/30 p-4 transition-colors ${
        isActive ? "border-primary/60 bg-primary/5" : "border-border"
      } ${disabled ? "opacity-60" : ""}`}
      data-testid={`provider-card-${provider.id}`}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem
          value={provider.id}
          id={`provider-${provider.id}`}
          className="mt-1"
          disabled={disabled}
          data-testid={`provider-radio-${provider.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label
              htmlFor={`provider-${provider.id}`}
              className="text-sm font-semibold cursor-pointer"
            >
              {provider.label}
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-primary">
                  <Check className="h-3 w-3" /> active
                </span>
              )}
            </Label>
            <span className="text-xs text-muted-foreground font-mono">
              {provider.model}
            </span>
          </div>

          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            {provider.hasKey ? (
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Key saved:{" "}
                <span className="font-mono text-foreground">
                  {provider.keyPreview ?? "•••"}
                </span>
              </span>
            ) : provider.replitFallbackAvailable ? (
              <span>No admin key — using Replit's built-in integration</span>
            ) : (
              <span className="text-amber-600">No key configured</span>
            )}
          </div>

          <form
            onSubmit={handleSave}
            className="mt-3 flex flex-wrap gap-2 items-center"
            data-testid={`provider-key-form-${provider.id}`}
          >
            <Input
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={
                provider.hasKey
                  ? "Paste a new key to replace…"
                  : `Paste your ${provider.label} API key…`
              }
              className="h-9 text-sm flex-1 min-w-[220px]"
              data-testid={`provider-key-input-${provider.id}`}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={keyInput.trim().length < 4 || saving}
              data-testid={`save-provider-key-${provider.id}`}
            >
              {provider.hasKey ? "Replace" : "Save"}
            </Button>
            {provider.hasKey && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={handleClear}
                disabled={clearing}
                data-testid={`clear-provider-key-${provider.id}`}
              >
                Clear key
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export type { AiSettings };
