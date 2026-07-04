import { Progress } from "@nauta/ui/progress";

export interface WebLLMLoadingProps {
  /** 0-100 (useWebllmEngine's progress). */
  readonly progress: number;
  /** UI-SPEC ordered label state ("Downloading model…" -> "Loading into
   * WebGPU…"). */
  readonly progressText: string;
}

/**
 * WebLLMLoading (D-08 discretion, 22-UI-SPEC.md Copywriting Contract) —
 * inline download/init progress shown INSIDE the model-picker row while the
 * curated browser model loads, so the popover can stay open and the user
 * sees exactly what's happening (no separate modal/page).
 */
export function WebLLMLoading({
  progress,
  progressText,
}: WebLLMLoadingProps): React.ReactElement {
  return (
    <div className="flex w-full flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {progressText || "Downloading model… (~2.5GB, first run only)"}
      </span>
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}
