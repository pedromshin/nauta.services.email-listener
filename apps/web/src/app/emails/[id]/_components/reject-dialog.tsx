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

interface RejectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

/**
 * RejectDialog — AlertDialog confirmation before reject mutation fires.
 *
 * Per 06-UI-SPEC §3.9 / §6.3: title "Reject this region?"; destructive action
 * "Reject region"; cancel "Keep region". Closes on cancel without calling onConfirm.
 */
export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
}: RejectDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this region?</AlertDialogTitle>
          <AlertDialogDescription>
            The region will be marked as rejected and hidden from the default
            view. You can show it again using the &apos;Show history&apos;
            toggle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep region</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Reject region
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
