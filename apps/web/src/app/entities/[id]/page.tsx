import type { Metadata } from "next";

import { EntityDetail } from "./_components/entity-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: _id } = await params;
  return { title: "Entity — Nauta" };
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EntityDetail entityId={id} />;
}
