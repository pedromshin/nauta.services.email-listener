import type { Metadata } from "next";

import { MergeReviewQueue } from "./_components/merge-review-queue";

export const metadata: Metadata = {
  title: "Merge review — Polytoken",
  description:
    "Review AI-proposed duplicate entities: merge, reject, or skip each pair.",
};

/**
 * /entities/review route (EN-02) — server-component wrapper.
 * The queue itself (data, optimistic actions, skip state) lives in the
 * client component, mirroring /entities' page/gallery split.
 */
export default function EntitiesReviewPage(): React.ReactElement {
  return <MergeReviewQueue />;
}
