"use client";

import DOMPurify from "dompurify";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nauta/ui/card";
import { ScrollArea } from "@nauta/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nauta/ui/tabs";

interface BodyCardProps {
  bodyText: string | null;
  bodyHtml: string | null;
}

export function BodyCard({ bodyText, bodyHtml }: BodyCardProps) {
  // Sanitization is deferred until after client hydration so that
  // DOMPurify always runs in a real DOM environment.  The HTML tab is
  // disabled until `safeHtml` is ready, preventing any unsanitized HTML
  // from being written to the DOM — even if the "use client" boundary or
  // rendering strategy changes in the future (T-05-10, CR-01).
  const [safeHtml, setSafeHtml] = useState<string | null>(null);

  useEffect(() => {
    if (bodyHtml) {
      setSafeHtml(DOMPurify.sanitize(bodyHtml));
    } else {
      setSafeHtml(null);
    }
  }, [bodyHtml]);

  // Tab is only enabled once the sanitized output is ready
  const hasHtml = safeHtml !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Message</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text">Plain text</TabsTrigger>
            <TabsTrigger value="html" disabled={!hasHtml}>
              HTML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-3">
            <ScrollArea className="h-64">
              {bodyText ? (
                <pre
                  className="whitespace-pre-wrap text-sm font-mono leading-relaxed"
                  role="region"
                  aria-label="Message plain text"
                >
                  {bodyText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  No message body.
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="html" className="mt-3">
            <ScrollArea className="h-64">
              {hasHtml ? (
                <div
                  role="region"
                  aria-label="Message HTML"
                  className="prose prose-sm max-w-none text-sm"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: safeHtml is DOMPurify-sanitized after client hydration (T-05-10, CR-01)
                  dangerouslySetInnerHTML={{ __html: safeHtml }}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No HTML version available for this message.
                </p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
