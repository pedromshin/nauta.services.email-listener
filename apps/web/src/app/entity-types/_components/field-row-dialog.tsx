"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

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
} from "@polytoken/ui/alert-dialog";
import { Button, buttonVariants } from "@polytoken/ui/button";
import { Checkbox } from "@polytoken/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@polytoken/ui/dialog";
import { Input } from "@polytoken/ui/input";
import { Label } from "@polytoken/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@polytoken/ui/select";

import type { FieldType } from "./use-entity-type-admin";

// ---------------------------------------------------------------------------
// field_type allowlist (D-27) — exactly string | number | date | array | object
// ---------------------------------------------------------------------------

const FIELD_TYPES: ReadonlyArray<{ readonly value: FieldType; readonly label: string }> = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
];

const fieldFormSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(
      /^[a-z0-9_]+$/,
      "Slug may only contain lowercase letters, numbers and underscores",
    ),
  fieldType: z.enum(["string", "number", "date", "array", "object"]),
  isRequired: z.boolean(),
  isIdentifier: z.boolean(),
});

export interface FieldRowValues {
  readonly label: string;
  readonly slug: string;
  readonly fieldType: FieldType;
  readonly isRequired: boolean;
  readonly isIdentifier: boolean;
}

/** Existing field being edited; absent for create mode. */
export interface EditableField extends FieldRowValues {
  readonly id: string;
}

interface FieldRowDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Provided in edit mode; omitted/null in create mode. */
  readonly field?: EditableField | null;
  /**
   * Number of confirmed components referencing this field (D-27). When > 0 the
   * delete flow states a deactivate-not-hard-delete outcome. When `undefined`
   * the count is not known pre-delete: the copy stays NEUTRAL (it never promises
   * permanent deletion) because the server may soft-deactivate; the post-action
   * toast reports the authoritative outcome. A value of 0 means a confirmed hard
   * delete (destructive copy).
   */
  readonly referenceCount?: number;
  /** Disable controls while a mutation is in flight. */
  readonly busy?: boolean;
  readonly onSave: (values: FieldRowValues) => void;
  /** Edit mode only — resolves once the delete outcome is known. */
  readonly onDelete?: () => void | Promise<void>;
}

const EMPTY_VALUES: FieldRowValues = {
  label: "",
  slug: "",
  fieldType: "string",
  isRequired: false,
  isIdentifier: false,
};

/**
 * FieldRowDialog — controlled create/edit dialog for an entity-type field.
 *
 * - `field_type` is a Select constrained to the D-27 allowlist
 *   (string | number | date | array | object).
 * - Inputs are Zod-validated at the boundary before onSave fires.
 * - Edit mode shows a Delete affordance behind an AlertDialog. When the field
 *   is referenced by a confirmed component (referenceCount > 0) the dialog
 *   states it will DEACTIVATE rather than hard-delete, and the confirm button
 *   uses a non-`destructive` (secondary) variant — never presenting a
 *   soft-deactivate as a destructive hard delete (D-27).
 */
export function FieldRowDialog({
  open,
  onOpenChange,
  field,
  referenceCount,
  busy = false,
  onSave,
  onDelete,
}: FieldRowDialogProps) {
  const isEdit = field != null;
  const [values, setValues] = useState<FieldRowValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FieldRowValues, string>>>(
    {},
  );

  // Reset the form whenever the dialog opens (with or without an existing field).
  useEffect(() => {
    if (open) {
      setValues(
        field != null
          ? {
              label: field.label,
              slug: field.slug,
              fieldType: field.fieldType,
              isRequired: field.isRequired,
              isIdentifier: field.isIdentifier,
            }
          : EMPTY_VALUES,
      );
      setErrors({});
    }
  }, [open, field]);

  function patch<K extends keyof FieldRowValues>(
    key: K,
    value: FieldRowValues[K],
  ): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const parsed = fieldFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FieldRowValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldRowValues | undefined;
        if (key && fieldErrors[key] === undefined) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    onSave(parsed.data);
  }

  // Three pre-delete states (D-27):
  // - referenced  (count > 0)   → known deactivate; non-destructive copy.
  // - unknown      (undefined)  → count not known pre-delete; NEUTRAL copy that
  //                               never promises permanent deletion (the server
  //                               may soft-deactivate; the toast reports truth).
  // - hardDelete   (count === 0)→ confirmed hard delete; destructive copy.
  const referenced = referenceCount !== undefined && referenceCount > 0;
  const unknownReferences = referenceCount === undefined;
  const destructive = !referenced && !unknownReferences;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit field" : "Add field"}</DialogTitle>
            <DialogDescription>
              Define the label, slug and type of this property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={values.label}
              onChange={(e) => patch("label", e.target.value)}
              placeholder="Shipper Name"
              disabled={busy}
              aria-invalid={errors.label !== undefined}
            />
            {errors.label !== undefined && (
              <p className="text-xs text-destructive">{errors.label}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-slug">Slug</Label>
            <Input
              id="field-slug"
              value={values.slug}
              onChange={(e) => patch("slug", e.target.value)}
              placeholder="shipper_name"
              disabled={busy}
              aria-invalid={errors.slug !== undefined}
            />
            {errors.slug !== undefined && (
              <p className="text-xs text-destructive">{errors.slug}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Type</Label>
            <Select
              value={values.fieldType}
              onValueChange={(v) => patch("fieldType", v as FieldType)}
              disabled={busy}
            >
              <SelectTrigger id="field-type" aria-label="Field type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isRequired}
                onCheckedChange={(c) => patch("isRequired", c === true)}
                disabled={busy}
                aria-label="Required"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.isIdentifier}
                onCheckedChange={(c) => patch("isIdentifier", c === true)}
                disabled={busy}
                aria-label="Identifier"
              />
              Identifier
            </label>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit && onDelete != null ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    disabled={busy}
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {referenced
                        ? "Deactivate this field?"
                        : unknownReferences
                          ? "Remove this field?"
                          : "Delete this field?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {referenced
                        ? "This field is referenced by confirmed data, so it cannot be deleted. It will be deactivated and hidden from the schema instead, keeping existing records intact."
                        : unknownReferences
                          ? "If no confirmed data references this field it is removed permanently; if it is referenced it is deactivated and hidden from the schema instead, keeping existing records intact. You'll be told which happened."
                          : "This field will be permanently removed from the entity type. This cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep field</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({
                        // Non-destructive whenever the outcome could be a
                        // deactivate (D-27) — destructive only for a CONFIRMED
                        // hard delete (count === 0).
                        variant: destructive ? "destructive" : "secondary",
                      })}
                      onClick={() => {
                        void onDelete();
                      }}
                    >
                      {referenced
                        ? "Deactivate field"
                        : unknownReferences
                          ? "Remove field"
                          : "Delete field"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              {/* bg-primary (default variant) — non-destructive save. */}
              <Button type="submit" disabled={busy}>
                {isEdit ? "Save field" : "Add field"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
