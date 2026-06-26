"use client";

import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@nauta/ui/badge";
import { Button } from "@nauta/ui/button";
import { Input } from "@nauta/ui/input";
import { Label } from "@nauta/ui/label";
import { Switch } from "@nauta/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nauta/ui/table";
import { Textarea } from "@nauta/ui/textarea";

import {
  FieldRowDialog,
  type EditableField,
  type FieldRowValues,
} from "./field-row-dialog";
import type { EntityTypeAdminState } from "./use-entity-type-admin";

/** A field as returned by entityTypes.list. */
export interface DetailField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly dataType: string;
  readonly isRequired: boolean;
  readonly sortOrder: number;
  readonly isIdentifier: boolean;
}

/** An entity type as returned by entityTypes.list. */
export interface DetailEntityType {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly fields: ReadonlyArray<DetailField>;
}

const ALLOWED_FIELD_TYPES = ["string", "number", "date", "array", "object"] as const;
type FieldType = (typeof ALLOWED_FIELD_TYPES)[number];

/** Coerce the free-text dataType to the allowlist (defaults to string). */
function toFieldType(dataType: string): FieldType {
  return (ALLOWED_FIELD_TYPES as ReadonlyArray<string>).includes(dataType)
    ? (dataType as FieldType)
    : "string";
}

function toEditableField(field: DetailField): EditableField {
  return {
    id: field.id,
    label: field.label,
    slug: field.key,
    fieldType: toFieldType(field.dataType),
    isRequired: field.isRequired,
    isIdentifier: field.isIdentifier,
  };
}

interface EntityTypeDetailProps {
  readonly type: DetailEntityType;
  readonly admin: EntityTypeAdminState;
}

/**
 * EntityTypeDetail — the right detail pane (D-25): name/description form bound
 * to updateType (save-on-blur), an active Switch (deactivate is non-destructive,
 * never `destructive`), and a Fields table with add/edit/delete (via
 * FieldRowDialog) and up/down reorder (reorderFields). All writes route through
 * the admin hook (optimistic + toasts).
 */
export function EntityTypeDetail({ type, admin }: EntityTypeDetailProps) {
  const [label, setLabel] = useState(type.label);
  const [description, setDescription] = useState(type.description ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<DetailField | null>(null);

  // Re-seed the local form when a different entity type is selected.
  useEffect(() => {
    setLabel(type.label);
    setDescription(type.description ?? "");
  }, [type.id, type.label, type.description]);

  const typeBusy = admin.mutatingTypeIds.includes(type.id);
  const fields = [...type.fields].sort((a, b) => a.sortOrder - b.sortOrder);

  function commitLabel(): void {
    const next = label.trim();
    if (next.length > 0 && next !== type.label) {
      admin.updateType({ entityTypeId: type.id, label: next });
    } else if (next.length === 0) {
      setLabel(type.label); // reject empty — revert to the persisted value
    }
  }

  function commitDescription(): void {
    const next = description.trim();
    const current = type.description ?? "";
    if (next !== current) {
      admin.updateType({
        entityTypeId: type.id,
        description: next.length > 0 ? next : null,
      });
    }
  }

  function handleSaveField(values: FieldRowValues): void {
    if (editingField != null) {
      admin.updateField({
        fieldId: editingField.id,
        entityTypeId: type.id,
        slug: values.slug,
        label: values.label,
        fieldType: values.fieldType,
        isRequired: values.isRequired,
        isIdentifier: values.isIdentifier,
      });
    } else {
      admin.createField({
        entityTypeId: type.id,
        slug: values.slug,
        label: values.label,
        fieldType: values.fieldType,
        isRequired: values.isRequired,
        isIdentifier: values.isIdentifier,
        sortOrder: fields.length,
      });
    }
    setDialogOpen(false);
    setEditingField(null);
  }

  async function handleDeleteField(): Promise<void> {
    if (editingField == null) return;
    await admin.deleteField({
      fieldId: editingField.id,
      entityTypeId: type.id,
    });
    setDialogOpen(false);
    setEditingField(null);
  }

  function moveField(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    admin.reorderFields({
      entityTypeId: type.id,
      orderedFieldIds: next.map((f) => f.id),
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* Identity form */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Entity type
          </h2>
          <Badge variant={type.isActive ? "default" : "secondary"}>
            {type.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type-label">Name</Label>
          <Input
            id="type-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            disabled={typeBusy}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type-description">Description</Label>
          <Textarea
            id="type-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="What kind of document is this?"
            disabled={typeBusy}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="type-active">Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive types are hidden from extraction pickers.
            </p>
          </div>
          <Switch
            id="type-active"
            checked={type.isActive}
            onCheckedChange={(checked) =>
              admin.updateType({ entityTypeId: type.id, isActive: checked })
            }
            disabled={typeBusy}
            aria-label="Active"
          />
        </div>
      </div>

      {/* Fields table */}
      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fields</h3>
          <Button
            size="sm"
            onClick={() => {
              setEditingField(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" aria-hidden />
            Add field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No fields yet. Add the first property of this entity type.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead className="w-[120px] text-right">Order</TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const fieldBusy = admin.mutatingFieldIds.includes(field.id);
                return (
                  <TableRow
                    key={field.id}
                    className={fieldBusy ? "opacity-50" : undefined}
                  >
                    <TableCell className="font-medium">{field.label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {field.key}
                    </TableCell>
                    <TableCell>{field.dataType}</TableCell>
                    <TableCell>{field.isRequired ? "Yes" : "—"}</TableCell>
                    <TableCell>{field.isIdentifier ? "Yes" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Move ${field.label} up`}
                          disabled={index === 0 || typeBusy}
                          onClick={() => moveField(index, -1)}
                        >
                          <ChevronUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Move ${field.label} down`}
                          disabled={index === fields.length - 1 || typeBusy}
                          onClick={() => moveField(index, 1)}
                        >
                          <ChevronDown className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Edit ${field.label}`}
                        disabled={fieldBusy}
                        onClick={() => {
                          setEditingField(field);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <FieldRowDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingField(null);
        }}
        field={editingField != null ? toEditableField(editingField) : null}
        busy={
          editingField != null
            ? admin.mutatingFieldIds.includes(editingField.id)
            : false
        }
        onSave={handleSaveField}
        onDelete={editingField != null ? handleDeleteField : undefined}
      />
    </div>
  );
}
