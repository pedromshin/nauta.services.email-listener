"use client";

import { Badge } from "@polytoken/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@polytoken/ui/card";

interface Email {
  senderName: string | null;
  senderAddress: string;
  toAddresses: string[];
  receivedAt: Date | null;
  importerId: string | null;
  parseStatus: string;
}

interface MetadataCardProps {
  email: Email;
  fmt: (d: Date | string | null) => string;
  parseStatusVariant: (status: string) => "default" | "secondary" | "destructive";
}

export function MetadataCard({ email, fmt, parseStatusVariant }: MetadataCardProps) {
  const senderDisplay = email.senderName
    ? `${email.senderName} <${email.senderAddress}>`
    : email.senderAddress;

  const toDisplay =
    email.toAddresses.length <= 2
      ? email.toAddresses.join(", ")
      : `${email.toAddresses.slice(0, 2).join(", ")} +${email.toAddresses.length - 2} more`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">From</dt>
            <dd className="break-all">{senderDisplay}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">To</dt>
            <dd className="break-all">{toDisplay}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Received</dt>
            <dd>{fmt(email.receivedAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Importer</dt>
            <dd>
              {email.importerId ? (
                <Badge variant="outline">{email.importerId}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground font-medium">Status</dt>
            <dd>
              <Badge variant={parseStatusVariant(email.parseStatus)}>
                {email.parseStatus}
              </Badge>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
