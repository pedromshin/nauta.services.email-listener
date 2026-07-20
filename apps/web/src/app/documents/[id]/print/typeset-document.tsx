import { Fragment } from "react";

import type {
  Inline,
  ProvSpan,
  ReportBlock,
  ReportDocument,
} from "../../_lib/report-document";

/**
 * apps/web/src/app/documents/[id]/print/typeset-document.tsx
 *
 * DOCS-01 — the TYPESET renderer. Turns a {@link ReportDocument} into the
 * serif, 45–75ch, paper/ink layout print.css styles. A pure, server-renderable
 * component (no client state): the print route renders it and playwright
 * captures the result, so the PDF is a typeset document, never a screenshot.
 *
 * The provenance contract lives here: a `confirmed` span becomes the locked
 * `pmark pmark-confirmed` utility, a `suggested` span becomes
 * `pmark pmark-suggested` (globals.css §"SIGNATURE ELEMENT"). Nothing about the
 * mark is re-invented — the model carries the tier as data and this maps it to
 * the one mark language every surface shares, so provenance is preserved
 * identically in the PDF, the HTML, and any regenerate-from-spec (INV-7).
 */

function ProvenanceMark({ span }: { span: ProvSpan }) {
  const cls =
    span.tier === "confirmed"
      ? "pmark pmark-confirmed"
      : "pmark pmark-suggested";
  return (
    <span
      className={cls}
      // Human-readable origin on hover (Phase 70 acceptance 2, tier-1
      // disclosure) — harmless in the PDF, useful in the on-screen read.
      title={span.source}
      data-prov-tier={span.tier}
    >
      {span.text}
    </span>
  );
}

function renderRuns(runs: readonly Inline[]) {
  return runs.map((run, i) =>
    typeof run === "string" ? (
      <Fragment key={i}>{run}</Fragment>
    ) : (
      <ProvenanceMark key={i} span={run} />
    ),
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "heading":
      if (block.level === 1) return <h2 className="ts-h2">{block.text}</h2>;
      if (block.level === 2) return <h2 className="ts-h2">{block.text}</h2>;
      return <h3 className="ts-h3">{block.text}</h3>;
    case "paragraph":
      return <p className="ts-p">{renderRuns(block.runs)}</p>;
    case "evidence":
      return (
        <blockquote className="ts-evidence">
          <p className="ts-p" style={{ margin: 0 }}>
            {renderRuns(block.runs)}
          </p>
          {block.cite ? (
            <cite className="ts-evidence-cite">{block.cite}</cite>
          ) : null}
        </blockquote>
      );
    case "list": {
      const items = block.items.map((runs, i) => (
        <li key={i}>{renderRuns(runs)}</li>
      ));
      return block.ordered ? (
        <ol className="ts-list">{items}</ol>
      ) : (
        <ul className="ts-list">{items}</ul>
      );
    }
    default: {
      // Exhaustiveness guard — a new block kind must be handled here.
      const _never: never = block;
      return _never;
    }
  }
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function TypesetDocument({ doc }: { doc: ReportDocument }) {
  const generated = (() => {
    const d = new Date(doc.generatedAt);
    return Number.isNaN(d.getTime()) ? doc.generatedAt : dateFmt.format(d);
  })();

  return (
    <article className="ts-sheet">
      <header className="ts-masthead">
        <div className="ts-eyebrow">Polytoken · Document</div>
        <h1 className="ts-title">{doc.title}</h1>
        {doc.subtitle ? <p className="ts-subtitle">{doc.subtitle}</p> : null}
        <div className="ts-meta">
          <span>
            Generated <span className="tabular">{generated}</span>
          </span>
          {doc.source ? <span>{doc.source}</span> : null}
        </div>
      </header>

      <div className="ts-measure">
        {doc.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      <footer className="ts-legend">
        <span>Provenance</span>
        <span className="ts-legend-item">
          <span className="pmark pmark-confirmed">confirmed</span>
          <span>a human verified this</span>
        </span>
        <span className="ts-legend-item">
          <span className="pmark pmark-suggested">suggested</span>
          <span>machine-inferred, unconfirmed</span>
        </span>
      </footer>
    </article>
  );
}
