import type { Metadata } from "next";

import { EmailDetail } from "./_components/email-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: _id } = await params;
  return { title: "Loading… — Polytoken" };
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmailDetail emailId={id} />;
}
