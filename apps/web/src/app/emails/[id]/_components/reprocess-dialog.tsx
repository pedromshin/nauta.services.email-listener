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
} from "@nauta/ui/alert-dialog";
import { buttonVariants } from "@nauta/ui/button";

interface ReprocessDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

/**
 * ReprocessDialog — AlertDialog confirmation before reprocessEmail mutation fires.
 *
 * Per 07-UI-SPEC §3.7 / §6.7: non-destructive action (D-16 — supersede, never
 * delete). Uses `buttonVariants({ variant: "default" })` NOT "destructive" because
 * reprocessing is additive — confirmed data is never deleted.
 *
 * Title: "Reprocess this email?"
 * Cancel: "Keep current data"
 * Action: "Reprocess Email"
 */
export function ReprocessDialog({
  open,
  onOpenChange,
  onConfirm,
}: ReprocessDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reprocess this email?</AlertDialogTitle>
          <AlertDialogDescription>
            All existing region extractions will be superseded and new ones
            generated. Your confirmed regions and their field data are never
            deleted — they remain accessible via the history view.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current data</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "default" })}
            onClick={onConfirm}
          >
            Reprocess Email
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
