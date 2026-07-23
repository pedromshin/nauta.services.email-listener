"use client";

/**
 * use-merge-review.ts — optimistic mutation hook for the merge-review queue
 * (EN-02).
 *
 * WRITE-PATH REUSE (the EN-02 contract): merge/reject call the EXISTING
 * curation procedures — api.entities.confirmMerge / api.entities.rejectMerge
 * (packages/api-client/src/router/entities/mutations.ts), the exact same
 * write paths the detail page's confirm/dismiss (use-entity-curation.ts)
 * uses. No parallel write endpoint exists for the queue.
 *
 * Optimistic pattern follows the use-role-mutations.ts template: onMutate
 * cancel + snapshot the queue cache → optimistic setData (remove the pair,
 * decrement totalPending) → onError revert + toast → onSuccess invalidate
 * (queue + gallery, since pendingDuplicatesCount changes there too).
 */

import { useCallback, useState } from "react";

import { toast } from "sonner";

import { api } from "~/trpc/react";

import type { ReviewPair } from "./review-pair-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewQueueInput {
  readonly limit: number;
  readonly offset: number;
}

export interface MergeReviewState {
  /** Confirm the pair — candidate is merged INTO subject (subject survives). */
  readonly merge: (pair: ReviewPair) => void;
  /** Durably dismiss the suggestion (negative example, D-20). */
  readonly reject: (pair: ReviewPair) => void;
  /** pairKey -> in-flight action, for aria-busy + spinners. */
  readonly busyPairs: ReadonlyMap<string, "merge" | "reject">;
}

/** Snapshot of the reviewQueue cache, captured for optimistic revert. */
type QueueSnapshot = ReturnType<
  ReturnType<typeof api.useUtils>["entities"]["reviewQueue"]["getData"]
>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMergeReview(queueInput: ReviewQueueInput): MergeReviewState {
  const utils = api.useUtils();

  const [busyPairs, setBusyPairs] = useState<
    ReadonlyMap<string, "merge" | "reject">
  >(new Map());

  const setBusy = useCallback(
    (pairKey: string, action: "merge" | "reject" | null) => {
      setBusyPairs((prev) => {
        const next = new Map(prev);
        if (action === null) next.delete(pairKey);
        else next.set(pairKey, action);
        return next;
      });
    },
    [],
  );

  /** Optimistically remove a pair from the current queue page. */
  const removePairFromCache = useCallback(
    (pairKey: string) => {
      utils.entities.reviewQueue.setData(queueInput, (prev) => {
        if (prev === undefined) return prev;
        const items = prev.items.filter((item) => item.pairKey !== pairKey);
        return {
          ...prev,
          items,
          totalPending: Math.max(0, prev.totalPending - 1),
        };
      });
    },
    [utils, queueInput],
  );

  const revert = useCallback(
    (snapshot: QueueSnapshot) => {
      if (snapshot !== undefined) {
        utils.entities.reviewQueue.setData(queueInput, snapshot);
      }
    },
    [utils, queueInput],
  );

  const settle = useCallback(async () => {
    // Queue + gallery both reflect pending counts (gallery's
    // pendingDuplicatesCount + "Needs review" filter).
    await Promise.all([
      utils.entities.reviewQueue.invalidate(),
      utils.entities.list.invalidate(),
    ]);
  }, [utils]);

  // ---- merge — the EXISTING entities.confirmMerge write path ----
  const confirmMergeMutation = api.entities.confirmMerge.useMutation({
    onMutate: async ({ entityInstanceId, targetId }) => {
      await utils.entities.reviewQueue.cancel(queueInput);
      const prevData = utils.entities.reviewQueue.getData(queueInput);
      const pairKey = `${entityInstanceId}::${targetId}`;
      removePairFromCache(pairKey);
      setBusy(pairKey, "merge");
      return { prevData, pairKey };
    },
    onError: (_err, _vars, context) => {
      revert(context?.prevData);
      toast.error("Merge failed — changes were not saved.");
      if (context?.pairKey !== undefined) setBusy(context.pairKey, null);
    },
    onSuccess: async (_data, _vars, context) => {
      if (context?.pairKey !== undefined) setBusy(context.pairKey, null);
      await settle();
    },
  });

  // ---- reject — the EXISTING entities.rejectMerge write path ----
  const rejectMergeMutation = api.entities.rejectMerge.useMutation({
    onMutate: async ({ entityInstanceId, targetId }) => {
      await utils.entities.reviewQueue.cancel(queueInput);
      const prevData = utils.entities.reviewQueue.getData(queueInput);
      const pairKey = `${entityInstanceId}::${targetId}`;
      removePairFromCache(pairKey);
      setBusy(pairKey, "reject");
      return { prevData, pairKey };
    },
    onError: (_err, _vars, context) => {
      revert(context?.prevData);
      toast.error("Reject failed — changes were not saved.");
      if (context?.pairKey !== undefined) setBusy(context.pairKey, null);
    },
    onSuccess: async (_data, _vars, context) => {
      if (context?.pairKey !== undefined) setBusy(context.pairKey, null);
      await settle();
    },
  });

  // ---- Public handlers ----
  // Direction contract (matches the detail page + ConfirmMergeUseCase):
  // entityInstanceId = SURVIVOR (the pair's subject), targetId = the
  // candidate absorbed into it.

  const merge = useCallback(
    (pair: ReviewPair) => {
      confirmMergeMutation.mutate({
        entityInstanceId: pair.subject.id,
        targetId: pair.candidate.id,
      });
    },
    [confirmMergeMutation],
  );

  const reject = useCallback(
    (pair: ReviewPair) => {
      rejectMergeMutation.mutate({
        entityInstanceId: pair.subject.id,
        targetId: pair.candidate.id,
      });
    },
    [rejectMergeMutation],
  );

  return { merge, reject, busyPairs };
}
