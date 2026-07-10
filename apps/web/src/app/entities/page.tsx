import type { Metadata } from "next";

import { EntitiesGallery } from "./_components/entities-gallery";

export const metadata: Metadata = {
  title: "Your entities — Polytoken",
  description: "Browse and triage extracted entity identities.",
};

/**
 * /entities route — server-component wrapper.
 * All state (view, filters, pagination) lives in the client gallery shell.
 */
export default function EntitiesPage(): React.ReactElement {
  return <EntitiesGallery />;
}
