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
} from "@polytoken/ui/alert-dialog";
import { Button } from "@polytoken/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RejectMergeDialogProps {
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RejectMergeDialog({
  onConfirm,
  disabled = false,
  children,
}: RejectMergeDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this merge suggestion?</AlertDialogTitle>
          <AlertDialogDescription>
            This suggestion will be dismissed. The two entities will not be
            linked. You can still merge them manually later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep suggestion</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            aria-label="Confirm rejection of merge suggestion"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject suggestion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
