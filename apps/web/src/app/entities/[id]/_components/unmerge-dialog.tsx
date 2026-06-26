"use client";

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
} from "@nauta/ui/alert-dialog";
import { Button } from "@nauta/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnmergeDialogProps {
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UnmergeDialog({
  onConfirm,
  disabled = false,
  children,
}: UnmergeDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unmerge this entity?</AlertDialogTitle>
          <AlertDialogDescription>
            This will separate the merged entities back into distinct records.
            Occurrences will be reassigned to their original entities. This
            action cannot be undone automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep merged</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            aria-label="Confirm entity unmerge"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Unmerge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
