"use client";

import { useState } from "react";

import { Badge } from "@nauta/ui/badge";
import { Button } from "@nauta/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nauta/ui/card";

/** Signed URL entry with expiry tracking (WR-01). */
interface SignedUrlEntry {
  readonly url: string;
  /** Epoch ms at which the URL expires. */
  readonly expiresAt: number;
}

type SignedUrlCache = Record<string, SignedUrlEntry>;

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  storageKey: string | null;
  fileExt: string | null;
}

interface AttachmentsCardProps {
  attachments: Attachment[];
  signedUrls: SignedUrlCache;
  setSignedUrls: (updater: (prev: SignedUrlCache) => SignedUrlCache) => void;
  onView: (attachmentId: string) => void;
}

export function AttachmentsCard({
  attachments,
  signedUrls,
  setSignedUrls,
  onView,
}: AttachmentsCardProps) {
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});

  async function handleDownload(att: Attachment) {
    // Use cached URL only if still valid (WR-01)
    const entry = signedUrls[att.id];
    if (entry && entry.expiresAt > Date.now()) {
      window.open(entry.url, "_blank");
      return;
    }

    try {
      const res = await fetch(`/api/attachments/${att.id}`);
      if (!res.ok) {
        throw new Error("Server returned an error");
      }
      const json = (await res.json()) as { url?: string; error?: string };
      if (!json.url) {
        throw new Error(json.error ?? "No URL in response");
      }
      // Immutable update per CLAUDE.md — store with TTL (WR-01)
      setSignedUrls((prev) => ({
        ...prev,
        [att.id]: { url: json.url!, expiresAt: Date.now() + 55_000 },
      }));
      setFetchErrors((prev) => {
        const { [att.id]: _, ...rest } = prev;
        return rest;
      });
      window.open(json.url, "_blank");
    } catch {
      setFetchErrors((prev) => ({
        ...prev,
        [att.id]: "Could not generate download link. Please refresh and try again.",
      }));
    }
  }

  function handleViewPdf(att: Attachment) {
    onView(att.id);
  }

  const isPdf = (contentType: string) => contentType === "application/pdf";

  function getFileGlyph(att: Attachment) {
    if (isPdf(att.contentType)) return "PDF";
    const ext = att.fileExt ?? att.filename.split(".").pop()?.toUpperCase() ?? "FILE";
    return ext.slice(0, 4);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Attachments</CardTitle>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No attachments on this email.
          </p>
        ) : (
          <div className="space-y-3">
            {attachments.map((att) => (
              <div key={att.id}>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-8 shrink-0 text-xs font-mono">
                    {getFileGlyph(att)}
                  </span>
                  <span className="flex-1 truncate text-sm">{att.filename}</span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {att.contentType}
                  </Badge>
                  {isPdf(att.contentType) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPdf(att)}
                    >
                      View PDF
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(att)}
                    >
                      Download
                    </Button>
                  )}
                </div>
                {fetchErrors[att.id] && (
                  <p className="text-destructive mt-1 pl-11 text-sm">
                    {fetchErrors[att.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
