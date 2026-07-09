"use client";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { Input } from "@polytoken/ui/input";
import { Loader2 } from "lucide-react";

import { getStatusBadge } from "./status-badge";

// ---- Types ----

interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly isRequired: boolean;
}

export interface FieldsPanelProps {
  readonly phase: "extracting" | "reviewing" | "confirming" | "confirmed";
  readonly entityTypeLabel: string;
  readonly extractionRecordStatus: string | null;
  readonly confidenceScore: number | null;
  readonly fields: ReadonlyArray<FieldDef>;
  readonly extractedFields: Record<string, unknown>;
  readonly correctedFields: Record<string, unknown> | null;
  readonly confidenceBreakdown: Record<string, unknown> | null;
  readonly fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}

// ---- Helpers ----

function getFieldScore(
  confidenceBreakdown: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!confidenceBreakdown) return null;
  const raw = confidenceBreakdown[key];
  if (typeof raw === "number") return raw;
  return null;
}

// ---- Component ----

/**
 * FieldsPanel — inline extraction fields panel for the autofill review surface.
 *
 * Per 07-UI-SPEC §3.3 (panel structure), §3.4 (extracting spinner),
 * §3.6 (confirmed state), §6.3-6.5 (copy), §7 (a11y contracts).
 *
 * Phases:
 * - "extracting": spinner with aria-busy
 * - "reviewing" | "confirming": editable inputs + Confirm/Discard action row
 * - "confirmed": read-only paragraphs + Confirmed badge, no action row
 */
export function FieldsPanel({
  phase,
  entityTypeLabel,
  extractionRecordStatus,
  confidenceScore,
  fields,
  extractedFields,
  correctedFields,
  confidenceBreakdown,
  fieldValues,
  onFieldChange,
  onConfirm,
  onDiscard,
}: FieldsPanelProps) {
  // Extracting phase: spinner only
  if (phase === "extracting") {
    return (
      <div
        role="region"
        aria-label="Extracting fields…"
        aria-busy="true"
        className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"
      >
        <Loader2
          className="h-4 w-4 animate-spin text-primary"
          aria-hidden="true"
        />
        Extracting fields…
      </div>
    );
  }

  // Confirmed phase: read-only field values
  if (phase === "confirmed") {
    return (
      <div
        role="region"
        aria-label={`Extracted fields for ${entityTypeLabel}`}
        className="border-t"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="text-sm font-semibold text-foreground">
            {entityTypeLabel}
          </span>
          <div className="flex items-center gap-2">
            {confidenceScore !== null && (
              <span className="text-xs text-muted-foreground">
                {Math.round(confidenceScore * 100)}% overall
              </span>
            )}
            <Badge
              className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-sm"
              aria-label="Status: Confirmed"
            >
              Confirmed
            </Badge>
          </div>
        </div>
        {/* Field rows — read-only */}
        <div className="px-4 py-3 space-y-3">
          {fields.map((field) => {
            const value = String(
              correctedFields?.[field.key] ??
                extractedFields[field.key] ??
                "",
            );
            const fieldScore = getFieldScore(confidenceBreakdown, field.key);

            return (
              <div key={field.key}>
                <p className="text-sm font-medium">
                  {field.label}
                  {field.isRequired && (
                    <span
                      className="text-destructive text-xs ml-0.5"
                      aria-label={`${field.label} (required)`}
                    >
                      *
                    </span>
                  )}
                </p>
                <p className="text-sm text-foreground mt-1">{value}</p>
                {fieldScore !== null && (
                  <span
                    className={[
                      "text-xs",
                      fieldScore < 0.5
                        ? "text-destructive"
                        : "text-muted-foreground",
                    ].join(" ")}
                    aria-label={
                      fieldScore < 0.5
                        ? `${field.label} confidence: ${Math.round(fieldScore * 100)}%, low confidence`
                        : undefined
                    }
                  >
                    {Math.round(fieldScore * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Reviewing / confirming phase: editable inputs + action row
  const isConfirming = phase === "confirming";
  const statusBadge =
    extractionRecordStatus !== null
      ? getStatusBadge(extractionRecordStatus)
      : null;

  return (
    <div
      role="region"
      aria-label={`Extracted fields for ${entityTypeLabel}`}
      className="border-t"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <span className="text-sm font-semibold text-foreground">
          {entityTypeLabel}
        </span>
        <div className="flex items-center gap-2">
          {confidenceScore !== null && (
            <span className="text-xs text-muted-foreground">
              {Math.round(confidenceScore * 100)}% overall
            </span>
          )}
          {statusBadge !== null && (
            <Badge
              variant={statusBadge.variant}
              className={["shrink-0 text-xs", statusBadge.className]
                .filter(Boolean)
                .join(" ")}
            >
              {extractionRecordStatus}
            </Badge>
          )}
        </div>
      </div>

      {/* Field rows — editable */}
      <div className="px-4 py-3 space-y-3">
        {fields.map((field) => {
          const fieldScore = getFieldScore(confidenceBreakdown, field.key);

          return (
            <div key={field.key}>
              <p className="text-sm font-medium">
                {field.label}
                {field.isRequired && (
                  <span
                    className="text-destructive text-xs ml-0.5"
                    aria-label={`${field.label} (required)`}
                  >
                    *
                  </span>
                )}
              </p>
              <Input
                className="h-8 text-sm"
                value={fieldValues[field.key] ?? ""}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                aria-label={field.label}
                aria-required={field.isRequired}
              />
              {fieldScore !== null && (
                <span
                  className={[
                    "text-xs",
                    fieldScore < 0.5
                      ? "text-destructive"
                      : "text-muted-foreground",
                  ].join(" ")}
                  aria-label={
                    fieldScore < 0.5
                      ? `${field.label} confidence: ${Math.round(fieldScore * 100)}%, low confidence`
                      : undefined
                  }
                >
                  {Math.round(fieldScore * 100)}%
                </span>
              )}
            </div>
          );
        })}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-3 border-t mt-3">
          <Button
            variant="default"
            size="sm"
            aria-label="Confirm Fields"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            Confirm Fields
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Discard extraction results"
            onClick={onDiscard}
          >
            Discard Fields
          </Button>
        </div>
      </div>
    </div>
  );
}
