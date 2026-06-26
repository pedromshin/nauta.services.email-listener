"use client";

/**
 * use-entity-curation.ts — optimistic curation hook for the entity detail page.
 *
 * Implements D-21: snapshot/revert on confirmMerge, rejectMerge, unmerge.
 * T-10-60: all writes go through api.entities.* tRPC procedures (server-side
 * proxy with X-API-Key); no raw fetch() or API key in client bundle.
 * T-10-61: no dangerouslySetInnerHTML anywhere in this module.
 *
 * Pattern mirrors use-region-edit.ts (onMutate snapshot → optimistic setData
 * → onError revert → onSuccess dual-cache invalidate).
 */

import { useCallback, useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export interface EntityCurationState {
  /** Call to confirm a pending merge suggestion. */
  readonly confirmMerge: (entityInstanceId: string) => void;
  /** Call to reject a pending merge suggestion. */
  readonly rejectMerge: (entityInstanceId: string) => void;
  /** Call to unmerge this entity (navigate away on success). */
  readonly unmerge: () => void;
  /** IDs of pending-suggestion rows currently being confirmed. */
  readonly confirmingIds: ReadonlySet<string>;
  /** IDs of pending-suggestion rows currently being rejected. */
  readonly rejectingIds: ReadonlySet<string>;
  /** True while an unmerge mutation is in-flight. */
  readonly isUnmerging: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEntityCuration(entityId: string): EntityCurationState {
  const router = useRouter();
  const utils = api.useUtils();

  // Local in-flight ID tracking (for aria-busy on individual rows)
  const [confirmingIds, setConfirmingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [rejectingIds, setRejectingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isUnmerging, setIsUnmerging] = useState(false);

  // -------------------------------------------------------------------------
  // confirmMerge
  // -------------------------------------------------------------------------

  const confirmMergeMutation = api.entities.confirmMerge.useMutation({
    onMutate: ({ targetId }) => {
      // Snapshot current cache
      const prevData = utils.entities.byId.getData({ id: entityId });

      // Optimistic: remove suggestion from the list
      utils.entities.byId.setData({ id: entityId }, (prev) => {
        if (prev === null || prev === undefined) return prev;
        return {
          ...prev,
          pendingSuggestions: prev.pendingSuggestions.filter(
            (s) => s.entityInstanceId !== targetId,
          ),
        };
      });

      setConfirmingIds((prev) => new Set([...prev, targetId]));
      return { prevData, targetId };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entities.byId.setData({ id: entityId }, context.prevData);
      }
      toast.error("Merge failed — changes were not saved.");
      if (context?.targetId !== undefined) {
        setConfirmingIds((prev) => {
          const next = new Set(prev);
          next.delete(context.targetId);
          return next;
        });
      }
    },
    onSuccess: async (_data, { targetId }) => {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      // Dual-cache invalidate: detail + gallery
      await Promise.all([
        utils.entities.byId.invalidate({ id: entityId }),
        utils.entities.list.invalidate(),
      ]);
    },
  });

  // -------------------------------------------------------------------------
  // rejectMerge
  // -------------------------------------------------------------------------

  const rejectMergeMutation = api.entities.rejectMerge.useMutation({
    onMutate: ({ targetId }) => {
      const prevData = utils.entities.byId.getData({ id: entityId });

      // Optimistic: remove suggestion from the list
      utils.entities.byId.setData({ id: entityId }, (prev) => {
        if (prev === null || prev === undefined) return prev;
        return {
          ...prev,
          pendingSuggestions: prev.pendingSuggestions.filter(
            (s) => s.entityInstanceId !== targetId,
          ),
        };
      });

      setRejectingIds((prev) => new Set([...prev, targetId]));
      return { prevData, targetId };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entities.byId.setData({ id: entityId }, context.prevData);
      }
      toast.error("Reject failed — changes were not saved.");
      if (context?.targetId !== undefined) {
        setRejectingIds((prev) => {
          const next = new Set(prev);
          next.delete(context.targetId);
          return next;
        });
      }
    },
    onSuccess: async (_data, { targetId }) => {
      setRejectingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      await Promise.all([
        utils.entities.byId.invalidate({ id: entityId }),
        utils.entities.list.invalidate(),
      ]);
    },
  });

  // -------------------------------------------------------------------------
  // unmerge
  // -------------------------------------------------------------------------

  const unmergeMutation = api.entities.unmerge.useMutation({
    onMutate: () => {
      setIsUnmerging(true);
      return {};
    },
    onError: (_err, _vars, _context) => {
      setIsUnmerging(false);
      toast.error("Unmerge failed — changes were not saved.");
    },
    onSuccess: async () => {
      // Navigate away — no toast, per spec
      await utils.entities.list.invalidate();
      router.push("/entities");
    },
  });

  // -------------------------------------------------------------------------
  // Stable callbacks
  // -------------------------------------------------------------------------

  const confirmMerge = useCallback(
    (targetId: string) => {
      confirmMergeMutation.mutate({ entityInstanceId: entityId, targetId });
    },
    [confirmMergeMutation, entityId],
  );

  const rejectMerge = useCallback(
    (targetId: string) => {
      rejectMergeMutation.mutate({ entityInstanceId: entityId, targetId });
    },
    [rejectMergeMutation, entityId],
  );

  const unmerge = useCallback(() => {
    unmergeMutation.mutate({ entityInstanceId: entityId });
  }, [unmergeMutation, entityId]);

  return {
    confirmMerge,
    rejectMerge,
    unmerge,
    confirmingIds,
    rejectingIds,
    isUnmerging,
  };
}
