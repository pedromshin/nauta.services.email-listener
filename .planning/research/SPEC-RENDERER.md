# Spec/DSL Design + Trusted Renderer Architecture

**Domain:** Runtime, spec-first generative-UI engine (LLM → constrained spec → trusted renderer → @nauta/ui)
**Researched:** 2026-06-26
**Overall confidence:** HIGH (core patterns), MEDIUM (RSC/streaming specifics)

---

## 1. PROBLEM FRAMING

An LLM emits a constrained, typed description of a UI (the "spec"). A trusted React renderer
interprets that spec into real components from a fixed registry — WITHOUT executing
model-authored code (no eval/new Function). This document answers:

- What spec shape to use
- How to build and constrain the component registry/manifest
- How to wire a recursive React interpreter
- How to model interactivity (state/actions) as declared primitives
- What the spec-vs-raw-TSX tradeoff looks like at runtime

Host environment: Next.js 14 App Router, React 18, TS strict, Zod, @nauta/ui
(Radix/shadcn), tRPC + TanStack Query.

---

## 2. ECOSYSTEM SURVEY

### 2.1 Comparable Systems

**Adaptive Cards (Microsoft)**
Schema-first, `type`-discriminated JSON tree. Root = `AdaptiveCard`. Elements are
`TextBlock`, `Container`, `ColumnSet`, `Input.Text`, etc. Children live in `body: []`
arrays, with `columns: []` for columnar layouts. Actions (buttons) in `actions: []` at the
card or element level. State is ephemeral — inputs collect values; `Action.Submit` sends
them back. Versioned via a top-level `"version": "1.6"` string; unknown versions render
`fallbackText`. Full JSON Schema published; renderers are platform-specific trusted parsers.

Verdict: excellent model for a constrained spec. The `type`+`body` pattern is directly
applicable. Version field in the root is the right place.

Source: https://adaptivecards.io/explorer/

**Puck (visual React editor)**
Data model: `{ content: ComponentData[], root: {props: {}}, zones: {} }`. Each node is
`{ type: string, props: { id: string, ...componentProps } }`. The newer Slots API (v0.19+)
stores children inside the parent's `props` as a named array (`items: ComponentData[]`),
making the tree self-contained and portable. No state model — Puck is an editor DSL, not a
runtime.

Verdict: the Slot API shape (children inside props keyed by slot name) is the right pattern
for this project. Avoids the `zones: { "id:slot": [] }` flat-table anti-pattern.

Source: https://puckeditor.com/docs/api-reference/data-model/data
        https://puckeditor.com/blog/puck-019

**Airbnb Ghost Platform (SDUI)**
Three-primitive model: Sections (typed discriminated union), Screens (layout + section
placement), Actions (declarative event handlers). Registry lookup: renderer map keyed by
`SectionComponentType`. Actions reference handler IDs registered client-side — the server
never sends executable code. State is declared server-side and actualized client-side.

Verdict: the three-primitive separation (layout / content / action) is the right split for
complex SDUI. For a simpler engine, collapsing layout+content into a single node tree is
fine as long as actions remain declarative strings referencing a handler registry.

Source: https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5

**DivKit (Yandex)**
Open-source SDUI for cross-platform (Android/iOS/Web). JSON schema with typed blocks:
containers, text, image, button, input. Interactivity via `actions: [{ logId, url }]` and
`visibility_action`. State managed by "variables" declared in the spec root, referenced
via `@{variableName}` expressions in prop values. Client evaluates these templates — the
server never executes them.

Verdict: the variable-declaration-at-root + `@{expr}` template pattern is viable but
fragile for an LLM emitter (hallucinated variable names are invisible until render). Better
to use the Airbnb/WireAI pattern: actions are declared as string IDs bound to handler
functions at boot, not inline templates.

Source: https://divkit.tech/en/ | https://github.com/divkit/divkit

**JSONForms**
Dual-schema: JSON Schema (data) + UI Schema (layout). UI Schema elements are typed objects:
`{ type: "Control", scope: "#/properties/email" }` or `{ type: "HorizontalLayout",
elements: [..] }`. Children live in `elements: UISchemaElement[]`. Renderer registry: each
renderer is a React component registered with a tester (rank-based priority). Zod integration
possible via drizzle-zod or manual mapping.

Verdict: the data-schema-as-constraint + ui-schema-as-layout separation is powerful for
form-focused UIs. Too form-centric for general-purpose generative UI; overkill here.

Source: https://jsonforms.io/docs/uischema/ | https://jsonforms.io/docs/tutorial/custom-renderers

**Google A2UI v0.9**
Open protocol for Agent-to-UI. Flat JSON: `{ "component": "Text", "text": "Hello world" }`.
Schema split into four files. Bidirectional: client sends data models back to agent via
`sendDataModel`. Catalog negotiation (three-step handshake). "Checks" array declares
client-side validators. Prompt-first: schema lives in system prompt, not structured output.

Verdict: flat per-node design is minimal but loses type safety on children/slots. The
catalog-negotiation pattern is useful if the spec server needs to discover what components
the client can render.

Source: https://www.copilotkit.ai/blog/a2ui-whats-new-in-google-generative-ui-spec

**WireAI (React Native)**
`registerComponent({ name, description, propsSchema: z.object({...}), component })`.
LLM returns `{ component: string, props: {...}, action: string }`. WireAI validates with
Zod before rendering; fallback text on failure. System prompt auto-generated from registry.

Verdict: the `name + description + propsSchema + component` manifest entry is the exact
right shape. The auto-prompt-generation from manifest is a key capability to build.

Source: https://getwireai.com/

**Local precedent: `packages/ui/src/spreadsheet-grid/column-defs.ts`**
This is the highest-confidence reference pattern in the codebase. `SchemaFieldType`
discriminated union → `getRendererAndEditor(col)` switch → returns `{ cellRenderer,
cellEditor }`. `buildColumnDefs()` maps column specs to AG Grid ColDef[]. Exactly the
"spec node → registered component" interpreter pattern needed.

The type registry here is:
```
"text" | "number" | "date" | "boolean" | "url" | "email" | "enum" | "json" | "array"
→ { DateCellRenderer, DateCellEditor } | { NumberCellRenderer, ... } | ...
```

For a generative-UI engine: substitute `SchemaFieldType` with `SpecNodeType` and
`ColDef<SpreadsheetRow>` with `React.ReactElement`.

---

## 3. SPEC SCHEMA DESIGN

### 3.1 Recommended Shape: Nested Discriminated-Union Tree

**Use a nested tree, not a flat node table.**

Flat node tables (where children are stored as `parentId` references in a flat array)
require a client-side reassembly step and complicate incremental streaming (you can't
render a node until you've seen all its children). A nested tree maps directly to React's
`createElement` hierarchy and is what every successful SDUI system uses.

The flat-table approach is only better when: (a) you need to incrementally append nodes
(e.g. a chat history), or (b) nodes can appear in multiple parent positions. Neither applies
to a generative UI spec.

### 3.2 Zod Schema Sketch

```typescript
import { z } from "zod";

// --- Primitive leaf types ---

const TextNodeSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
  variant: z.enum(["body", "label", "caption", "heading"]).optional(),
  muted: z.boolean().optional(),
});

const BadgeNodeSchema = z.object({
  type: z.literal("badge"),
  label: z.string(),
  variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
});

const ButtonNodeSchema = z.object({
  type: z.literal("button"),
  label: z.string(),
  variant: z.enum(["default", "outline", "ghost", "destructive"]).optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
  // action is a declared string ID — never executable code
  action: z.string().optional(), // resolves to ActionHandler in the renderer
  disabled: z.boolean().optional(),
});

// --- Forward reference for recursive children ---

// SpecNodeSchema is defined below; ChildrenSchema uses z.lazy to break circularity
type SpecNode = z.infer<typeof SpecNodeSchema>;
const ChildrenSchema: z.ZodType<SpecNode[]> = z.lazy(() =>
  z.array(SpecNodeSchema)
);

// --- Layout/container types ---

const CardNodeSchema = z.object({
  type: z.literal("card"),
  title: z.string().optional(),
  description: z.string().optional(),
  children: ChildrenSchema.optional(),
  // Named slots — alternative to positional children
  header: z.lazy(() => SpecNodeSchema).optional(),
  footer: z.lazy(() => SpecNodeSchema).optional(),
});

const StackNodeSchema = z.object({
  type: z.literal("stack"),
  direction: z.enum(["vertical", "horizontal"]).default("vertical"),
  gap: z.enum(["none", "sm", "md", "lg"]).default("md"),
  children: ChildrenSchema,
});

const GridNodeSchema = z.object({
  type: z.literal("grid"),
  cols: z.number().int().min(1).max(12).default(2),
  gap: z.enum(["none", "sm", "md", "lg"]).default("md"),
  children: ChildrenSchema,
});

// --- Data-bound types ---

const KeyValueListNodeSchema = z.object({
  type: z.literal("key-value-list"),
  // items bound to spec-declared data references
  items: z.array(
    z.object({
      key: z.string(),
      valueRef: z.string(), // e.g. "email.subject" — resolved by renderer
    })
  ),
});

// --- Conditional rendering ---

const ConditionalNodeSchema = z.object({
  type: z.literal("conditional"),
  condition: z.object({
    // References a declared state/data binding; never inline JS
    dataRef: z.string(),        // "state.isExpanded" | "data.status"
    operator: z.enum(["eq", "neq", "truthy", "falsy", "gt", "lt"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  }),
  then: z.lazy(() => SpecNodeSchema),
  else: z.lazy(() => SpecNodeSchema).optional(),
});

// --- List/iteration ---

const ListNodeSchema = z.object({
  type: z.literal("list"),
  dataRef: z.string(),    // "data.items" — references a named data binding
  itemKey: z.string(),    // field name within each item to use as React key
  itemTemplate: z.lazy(() => SpecNodeSchema), // rendered per item
  emptyState: z.lazy(() => SpecNodeSchema).optional(),
});

// --- State declarations (declared primitives) ---

const StateDeclarationSchema = z.object({
  name: z.string(), // slot name, e.g. "isExpanded"
  type: z.enum(["boolean", "string", "number", "null"]),
  initial: z.union([z.boolean(), z.string(), z.number(), z.null()]),
  // allowed mutations — never free-form JS
  actions: z.array(
    z.object({
      name: z.string(),          // e.g. "toggle", "set", "increment"
      mutation: z.enum(["toggle", "set", "reset", "increment", "decrement"]),
      value: z.union([z.boolean(), z.string(), z.number(), z.null()]).optional(),
    })
  ).optional(),
});

// --- Spec root ---

const SpecRootSchema = z.object({
  // Schema version — increment on breaking changes
  v: z.literal(1),
  // Named data bindings injected at render time by the host
  data: z.record(z.string(), z.unknown()).optional(),
  // Declared state slots the renderer will instantiate
  state: z.array(StateDeclarationSchema).optional(),
  // The component tree
  root: z.lazy(() => SpecNodeSchema),
});

// --- Main discriminated union ---

const SpecNodeSchema = z.discriminatedUnion("type", [
  TextNodeSchema,
  BadgeNodeSchema,
  ButtonNodeSchema,
  CardNodeSchema,
  StackNodeSchema,
  GridNodeSchema,
  KeyValueListNodeSchema,
  ConditionalNodeSchema,
  ListNodeSchema,
]);

type SpecRoot = z.infer<typeof SpecRootSchema>;
type SpecNode = z.infer<typeof SpecNodeSchema>;
```

**Notes on design decisions:**

1. **`z.lazy()` for recursion.** Required because `SpecNodeSchema` references itself through
   `children`. Zod's `z.discriminatedUnion` does NOT support recursive types directly —
   use `z.lazy(() => z.array(SpecNodeSchema))` for children arrays, and
   `z.lazy(() => SpecNodeSchema)` for single-node slots. Known Zod limitation: recursive
   inference breaks type narrowing on the recursive field, so annotate it with
   `z.ZodType<SpecNode[]>` explicitly.

   Source: https://github.com/colinhacks/zod/discussions/3477

2. **Named slots vs. positional children.** Use both:
   - `children: SpecNode[]` for positional composition (stack, grid)
   - Named slots (`header`, `footer`) on container nodes for structured layout

3. **`v: z.literal(1)`.** Put the version at the root, not on every node. When schema breaks,
   bump to `v: 2` and add a migration function `migrateSpec(v1: SpecV1Root): SpecV2Root`.
   Never use `z.string()` for version — `z.literal(N)` forces the LLM to emit the exact
   current version, making stale generations detectable immediately.

4. **`dataRef: string` for iteration/conditional.** Never embed data inline in the spec. The
   spec declares *references* to named bindings; the renderer resolves them against host-
   provided data. This separates the "what to show" (spec) from the "what data to show it
   with" (host).

5. **`action: string` for buttons.** Never executable code. The renderer maps action strings
   to pre-registered handler functions in an `ActionRegistry`. The LLM is constrained to
   known action names from the manifest.

### 3.3 Flat Table vs. Nested Tree Decision

| Criterion | Nested Tree | Flat Table |
|-----------|-------------|------------|
| Streaming render | Render as tokens arrive (can render partial tree top-down) | Cannot render until all children visible |
| React mapping | Direct 1:1 with `createElement` hierarchy | Requires O(n) reassembly step |
| LLM generation | Natural recursive generation; fewer tokens wasted on IDs | Every node needs a stable ID; cross-references error-prone |
| Incremental update | Replace a subtree atomically (use stable `key` at subtree root) | Can surgically update single nodes via ID |
| Shared/multiple parents | Not possible | Possible (DAG) |
| Memory | Small overhead from nesting | Small overhead from ID index |

**Decision: nested tree.** The only use case for flat tables is DAG node-sharing, which
generative UI specs don't need.

---

## 4. COMPONENT REGISTRY / MANIFEST

### 4.1 Manifest Entry Shape

Each registerable component has a manifest entry that:
- Defines the Zod schema for props the LLM may set
- Marks props as LLM-settable vs. renderer-locked
- Provides a natural-language description (auto-included in the system prompt)
- References the actual React component

```typescript
import type { ComponentType } from "react";
import type { ZodType } from "zod";

interface ManifestEntry<TProps extends Record<string, unknown>> {
  /** Stable string ID the LLM uses in the spec's `type` field */
  readonly type: string;
  /** Human-readable description for the LLM system prompt */
  readonly description: string;
  /** Example spec node JSON for few-shot prompting */
  readonly example: Record<string, unknown>;
  /** Zod schema for ALL props the LLM may set — validated before rendering */
  readonly propsSchema: ZodType<TProps>;
  /** Props locked by the renderer (excluded from LLM settable set) */
  readonly lockedProps?: ReadonlyArray<keyof TProps>;
  /** Slot names this component accepts as named children */
  readonly slots?: ReadonlyArray<string>;
  /** Whether this component can accept positional children */
  readonly acceptsChildren?: boolean;
  /** The actual React component — never exposed to the LLM */
  readonly component: ComponentType<TProps>;
}

type AnyManifestEntry = ManifestEntry<Record<string, unknown>>;

/** The full registry — keyed by node type string */
type ComponentRegistry = Readonly<Record<string, AnyManifestEntry>>;
```

### 4.2 Registry Construction (tailored to @nauta/ui)

```typescript
import { z } from "zod";
import { Badge } from "@nauta/ui/badge";
import { Button } from "@nauta/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nauta/ui/card";
// ...etc

export const NAUTA_REGISTRY: ComponentRegistry = {
  badge: {
    type: "badge",
    description: "A small status label. Use for parse statuses, entity types, or categorical values.",
    example: { type: "badge", label: "Confirmed", variant: "default" },
    propsSchema: z.object({
      label: z.string(),
      variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
    }),
    component: ({ label, variant }) => <Badge variant={variant}>{label}</Badge>,
  },

  button: {
    type: "button",
    description: "An interactive button. The `action` field must be a known action name from the action registry.",
    example: { type: "button", label: "Confirm Field", variant: "default", action: "confirm-field" },
    propsSchema: z.object({
      label: z.string(),
      variant: z.enum(["default", "outline", "ghost", "destructive"]).optional(),
      size: z.enum(["sm", "md", "lg"]).optional(),
      action: z.string().optional(),
      disabled: z.boolean().optional(),
    }),
    lockedProps: [], // action is LLM-settable (but constrained to known names)
    component: ({ label, variant, size, action: actionId, disabled }) => {
      const handler = useActionRegistry(actionId);
      return (
        <Button variant={variant} size={size} disabled={disabled} onClick={handler}>
          {label}
        </Button>
      );
    },
  },

  card: {
    type: "card",
    description: "A bordered container card. Use as a structural grouping.",
    example: { type: "card", title: "Details", children: [] },
    propsSchema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    acceptsChildren: true,
    slots: ["header", "footer"],
    component: ({ title, description, children }) => (
      <Card>
        {(title || description) && (
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
          </CardHeader>
        )}
        <CardContent>{children}</CardContent>
      </Card>
    ),
  },
} as const;
```

### 4.3 Auto-Extraction vs. Hand-Authored

**Do NOT rely on react-docgen-typescript for the manifest.** It extracts TypeScript prop
types, but:
- It cannot infer `enum` constraints from `z.enum()` — those live in validation logic, not
  TS types
- It cannot mark props as LLM-settable vs. locked
- It cannot write descriptions or examples
- It picks up every internal prop (className, ref, etc.) that must be excluded

**Instead:** hand-author the manifest for each exposed component. This is the correct
decision for ~20–40 components. The manifest IS the contract; it should be explicit.

Use react-docgen-typescript as a reference during manifest authoring (to check you haven't
missed a prop), not as the source of truth.

**CI enforcement:** write a test that validates every manifest entry's `propsSchema`
against its `example` field. This catches stale manifests immediately.

```typescript
// manifest.test.ts
for (const [type, entry] of Object.entries(NAUTA_REGISTRY)) {
  it(`manifest.${type}: example passes propsSchema`, () => {
    expect(() => entry.propsSchema.parse(entry.example)).not.toThrow();
  });
}
```

### 4.4 Manifest → System Prompt Generation

```typescript
function buildSystemPrompt(registry: ComponentRegistry): string {
  const componentDocs = Object.values(registry)
    .map((entry) => `
## ${entry.type}
${entry.description}
Schema: ${JSON.stringify(zodToJsonSchema(entry.propsSchema), null, 2)}
Example: ${JSON.stringify(entry.example)}
Slots: ${entry.slots?.join(", ") ?? "none"}
Children: ${entry.acceptsChildren ? "yes" : "no"}
    `.trim())
    .join("\n\n");

  return `
You are a UI spec generator. Output valid JSON matching the SpecRoot schema (v: 1).
Only use component types listed below. Never emit executable code, eval(), or JavaScript.

AVAILABLE COMPONENTS:
${componentDocs}

RULES:
- "action" fields must be one of the declared action names in the context
- "dataRef" fields must reference named bindings from the data context
- Children must be arrays of valid SpecNodes
- Produce the minimum viable tree for the user's intent
`;
}
```

---

## 5. THE INTERPRETER (React internals)

### 5.1 Core Interpreter Pattern

The interpreter maps spec nodes to `React.createElement` calls via registry lookup. This is
the exact same pattern as `getRendererAndEditor(col)` in `column-defs.ts`, generalized to
a recursive tree.

```typescript
import React from "react";
import type { SpecNode, SpecRoot } from "./spec-schema";
import type { ComponentRegistry } from "./registry";

interface RenderContext {
  readonly data: Record<string, unknown>;
  readonly state: Record<string, unknown>;   // resolved state atoms
  readonly dispatch: (action: string, value?: unknown) => void;
  readonly registry: ComponentRegistry;
}

function renderNode(node: SpecNode, ctx: RenderContext, keyPrefix: string): React.ReactElement {
  const entry = ctx.registry[node.type];

  if (!entry) {
    // Unknown type — fail safe, never crash the page
    return (
      <div
        key={keyPrefix}
        role="alert"
        className="border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive rounded"
      >
        Unknown component: {node.type}
      </div>
    );
  }

  // Validate props against manifest schema before touching React
  const propsResult = entry.propsSchema.safeParse(
    Object.fromEntries(
      Object.entries(node).filter(([k]) => k !== "type" && k !== "children")
    )
  );

  if (!propsResult.success) {
    return (
      <div key={keyPrefix} role="alert" className="text-xs text-destructive">
        Spec error in {node.type}: {propsResult.error.message}
      </div>
    );
  }

  // Recursively render positional children
  const positionalChildren = "children" in node && Array.isArray((node as { children: SpecNode[] }).children)
    ? (node as { children: SpecNode[] }).children.map((child, i) =>
        renderNode(child, ctx, `${keyPrefix}-${i}`)
      )
    : undefined;

  // Resolve named slot children (card.header, card.footer, etc.)
  const slotChildren: Record<string, React.ReactElement> = {};
  if (entry.slots) {
    for (const slotName of entry.slots) {
      const slotNode = (node as Record<string, unknown>)[slotName];
      if (slotNode && typeof slotNode === "object" && "type" in (slotNode as object)) {
        slotChildren[slotName] = renderNode(slotNode as SpecNode, ctx, `${keyPrefix}-slot-${slotName}`);
      }
    }
  }

  const Component = entry.component as React.ComponentType<Record<string, unknown>>;

  return (
    <ErrorBoundary key={keyPrefix} fallback={<NodeErrorFallback type={node.type} />}>
      <Component {...propsResult.data} {...slotChildren}>
        {positionalChildren}
      </Component>
    </ErrorBoundary>
  );
}

// Entry point
export function SpecRenderer({
  spec,
  registry,
  data,
  onAction,
}: {
  readonly spec: SpecRoot;
  readonly registry: ComponentRegistry;
  readonly data: Record<string, unknown>;
  readonly onAction: (actionId: string, value?: unknown) => void;
}): React.ReactElement {
  const { state, dispatch } = useDeclaredState(spec.state ?? []);

  const ctx: RenderContext = {
    data: { ...spec.data, ...data }, // merge spec-provided + host-provided data
    state,
    dispatch,
    registry,
  };

  return renderNode(spec.root, ctx, "root");
}
```

### 5.2 Error Boundaries Per Node

Wrap every registry dispatch in an `ErrorBoundary`. A malformed spec or a component bug
must never propagate to the page shell.

```typescript
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactElement },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function NodeErrorFallback({ type }: { readonly type: string }): React.ReactElement {
  return (
    <div role="alert" className="border border-destructive/50 rounded p-2 text-xs text-destructive">
      Render error in &ldquo;{type}&rdquo; — this component failed to render.
    </div>
  );
}
```

### 5.3 Key Management for Reconciliation

The spec may be regenerated (LLM produces a revised spec). React's reconciliation will
diff old vs. new trees. Without stable keys, React unmounts-then-remounts every node,
destroying focus and scroll state.

**Pattern:** assign keys based on structural position (`root-0-1-2`), NOT random IDs. A
node at the same structural path across two spec generations gets the same key — React
reconciles efficiently. Only nodes that truly moved position get new keys (triggering
unmount/remount, which is correct for moved nodes).

**Do NOT** ask the LLM to generate node IDs. They will be unstable (hallucinated UUIDs)
and defeat reconciliation. Use the interpreter's `keyPrefix` traversal instead.

### 5.4 Conditional Rendering

For `conditional` nodes, the interpreter resolves the `dataRef` against `ctx.data` and
`ctx.state`:

```typescript
case "conditional": {
  const { dataRef, operator, value } = node.condition;
  const resolvedValue = resolveDataRef(dataRef, ctx);
  const passes = evaluateCondition(resolvedValue, operator, value);
  const branch = passes ? node.then : node.else;
  if (!branch) return <React.Fragment key={keyPrefix} />;
  return renderNode(branch, ctx, `${keyPrefix}-${passes ? "then" : "else"}`);
}

function resolveDataRef(ref: string, ctx: RenderContext): unknown {
  const [namespace, ...path] = ref.split(".");
  const root = namespace === "state" ? ctx.state : ctx.data;
  return path.reduce<unknown>((obj, key) =>
    obj != null && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined,
    root
  );
}
```

**Safety:** `resolveDataRef` never calls `eval`. It is a simple dotted-path resolver.
Unknown refs return `undefined`, which the condition operator handles.

### 5.5 List/Iteration

```typescript
case "list": {
  const items = resolveDataRef(node.dataRef, ctx);
  if (!Array.isArray(items)) {
    return node.emptyState ? renderNode(node.emptyState, ctx, `${keyPrefix}-empty`) : <React.Fragment key={keyPrefix} />;
  }
  if (items.length === 0 && node.emptyState) {
    return renderNode(node.emptyState, ctx, `${keyPrefix}-empty`);
  }
  return (
    <React.Fragment key={keyPrefix}>
      {items.map((item, i) => {
        const itemKey = node.itemKey && typeof item === "object" && item != null
          ? String((item as Record<string, unknown>)[node.itemKey] ?? i)
          : String(i);
        const childCtx = { ...ctx, data: { ...ctx.data, item } };
        return renderNode(node.itemTemplate, childCtx, `${keyPrefix}-item-${itemKey}`);
      })}
    </React.Fragment>
  );
}
```

### 5.6 Suspense and Streaming

For a spec that arrives progressively (streamed tokens from the LLM), two patterns:

**Option A — Whole-spec Suspense:** Collect the entire spec JSON, then render. Use a
Suspense boundary at the SpecRenderer level with a skeleton fallback. Simplest; the spec
is already small (< 5 KB for typical generative UI).

```tsx
<Suspense fallback={<SpecSkeleton />}>
  <SpecRenderer spec={spec} ... />
</Suspense>
```

**Option B — Progressive partial specs:** Stream partial spec trees as the LLM emits them,
rendering top-level nodes as they arrive. Requires partial JSON parsing (e.g., `partial-json`
npm package). This adds complexity; only needed if the spec is very large or the LLM
response latency is the dominant UX bottleneck.

**Recommendation for this project: Option A.** The spec is small. The dominant latency is
the LLM invocation itself. Render the whole spec atomically once validated.

### 5.7 RSC vs. Client Island

For this spec renderer, **use a client island ("use client")**, not RSC. Reasons:

1. The spec contains declared state (`StateDeclarationSchema`). State instantiation requires
   the client. RSC components cannot hold state.

2. The component registry includes interactive components (Button, Switch, Input). These
   must be client components.

3. The spec may change at runtime (new LLM generation). RSC components cannot re-render
   in response to client-side state changes.

4. The `ErrorBoundary` class component requires client rendering.

**Hydration pitfall:** If the spec is server-rendered (RSC wrapping a client island), ensure
the initial spec is serializable and deterministic. Never include `Date.now()` or `Math.random()`
in a server-rendered spec. Use `suppressHydrationWarning` on wrappers if the initial spec
state differs between server and client (should be rare).

### 5.8 Performance: Memoizing Regenerated Subtrees

When the spec is regenerated (user triggers a new LLM call), avoid re-rendering unchanged
subtrees. Pattern: `useMemo` on the parsed spec, keyed by its JSON string representation.

```typescript
const parsedSpec = useMemo(
  () => SpecRootSchema.parse(JSON.parse(rawSpecJson)),
  [rawSpecJson]  // re-parse only when raw JSON changes
);
```

For subtree stability: since structural keys (`root-0-1-2`) are stable for unchanged
positions, React's reconciler preserves DOM nodes at unchanged positions automatically.
This is sufficient — do NOT add `React.memo` to the `renderNode` output; the ErrorBoundary
wrapper prevents React.memo from working (class components break the bailout chain).

---

## 6. DECLARED STATE / ABSTRACTED HOOKS

### 6.1 Pattern

State is declared in the spec root as a list of `StateDeclarationSchema` objects. The renderer
instantiates a `useReducer` store from this declaration. The LLM never writes hooks; it
declares slot names, types, initial values, and allowed mutations.

```typescript
interface StateDeclaration {
  readonly name: string;
  readonly type: "boolean" | "string" | "number" | "null";
  readonly initial: boolean | string | number | null;
  readonly actions?: ReadonlyArray<{
    readonly name: string;
    readonly mutation: "toggle" | "set" | "reset" | "increment" | "decrement";
    readonly value?: boolean | string | number | null;
  }>;
}

function useDeclaredState(declarations: readonly StateDeclaration[]): {
  state: Record<string, unknown>;
  dispatch: (actionName: string, value?: unknown) => void;
} {
  const initial = Object.fromEntries(
    declarations.map((d) => [d.name, d.initial])
  );

  const [state, dispatchRaw] = React.useReducer(
    (s: Record<string, unknown>, action: { name: string; value?: unknown }) => {
      // Find the declaration for this action name
      for (const decl of declarations) {
        const actionDef = decl.actions?.find((a) => a.name === action.name);
        if (!actionDef) continue;

        const current = s[decl.name];
        let next: unknown;

        switch (actionDef.mutation) {
          case "toggle":   next = !current; break;
          case "set":      next = action.value ?? actionDef.value; break;
          case "reset":    next = decl.initial; break;
          case "increment": next = (typeof current === "number" ? current : 0) + 1; break;
          case "decrement": next = (typeof current === "number" ? current : 0) - 1; break;
        }

        return { ...s, [decl.name]: next }; // immutable update
      }
      return s; // unknown action — no-op
    },
    initial
  );

  const dispatch = React.useCallback(
    (name: string, value?: unknown) => dispatchRaw({ name, value }),
    [dispatchRaw]
  );

  return { state, dispatch };
}
```

### 6.2 Why Not Zustand/Jotai?

For the generative spec's *declared* state, `useReducer` is preferred because:
- The state shape is not known at compile time (it's declared per-spec)
- `useReducer` with a dynamic initial state is exactly the right fit
- No library dependency added to the renderer
- State is scoped to the `SpecRenderer` instance and GC'd when the renderer unmounts

Use Jotai's `atomFamily` if spec nodes need *per-node* state that must survive a spec
re-render (e.g., a collapsible card that the user has opened; the spec might be regenerated
but the open/closed state should persist). Each `atomFamily(nodeKeyPrefix)` creates a
stable atom for that structural position.

Zustand is best for *out-of-spec* state that must be shared across multiple `SpecRenderer`
instances (e.g., selected entity ID that both a list spec-panel and a canvas need to know).

Source: https://jotai.org/docs/utilities/family | https://runharbor.com/blog/2025-10-26-improving-deeply-nested-react-render-performance-with-jotai-atomic-state

### 6.3 Action Handler Registry

Button actions declared in the spec (`action: "confirm-field"`) are resolved client-side:

```typescript
type ActionHandler = (value?: unknown) => void | Promise<void>;
type ActionRegistry = Readonly<Record<string, ActionHandler>>;

const ActionRegistryContext = React.createContext<ActionRegistry>({});

function useActionRegistry(actionId: string | undefined): (() => void) | undefined {
  const registry = React.useContext(ActionRegistryContext);
  if (!actionId) return undefined;
  return registry[actionId];
}

// Usage in SpecRenderer's parent:
<ActionRegistryContext.Provider value={{
  "confirm-field": () => confirmFieldMutation.mutate({ id: selectedFieldId }),
  "deny-field": () => denyFieldMutation.mutate({ id: selectedFieldId }),
  "autofill": () => autofillMutation.mutate({ entityId }),
}}>
  <SpecRenderer spec={spec} registry={NAUTA_REGISTRY} data={resolvedData} onAction={dispatch} />
</ActionRegistryContext.Provider>
```

This is the key safety property: the LLM can only *reference* action names; actual handlers
live in the host application and are wired up explicitly by the developer.

---

## 7. SPEC vs. RAW TSX CODE TRADEOFF

| Criterion | Constrained Spec | Raw TSX Code (eval/new Function) |
|-----------|-----------------|----------------------------------|
| **Safety** | HIGH — LLM cannot escape the registry; no arbitrary JS execution | CRITICAL RISK — arbitrary code execution; XSS surface |
| **Determinism** | HIGH — same spec + same data always renders same output | LOW — code can branch on window, Date.now(), etc. |
| **Debuggability** | HIGH — spec is inspectable JSON; can be logged, diffed, stored | LOW — generated code is opaque; hard to audit |
| **Flexibility** | MEDIUM — LLM is constrained to declared components/actions | HIGH — any React code is possible |
| **Iteration** | MEDIUM — adding a new capability requires adding to registry | HIGH — no registry needed |
| **Versioning** | HIGH — spec schema is versioned; breaking changes are explicit | LOW — no versioning; any change can silently break |
| **Testing** | HIGH — spec can be snapshot-tested; renderer is a pure function | LOW — difficult to test generated code |
| **LLM hallucinations** | Caught at Zod parse time; fallback rendered | Silently cause runtime errors |
| **Bundle size** | Only registered components are bundled | Any generated code could import anything |
| **Auditability** | Every generated UI is a storable JSON artifact | Code is ephemeral |

**Decision: use the constrained spec for all LLM-generated UI in this project.**

The flexibility gap is not a real gap in this use case: we know exactly which @nauta/ui
components exist, and the registry is the complete set. The LLM's job is to compose known
pieces into a layout, not to invent new components.

The only scenario where raw code wins is if the LLM needs to implement novel interaction
logic (e.g., "when the user hovers the invoice total, show a breakdown popup with live
exchange rates"). That should be handled by adding a new declared action type and a new
component to the registry, not by eval.

---

## 8. ARCHITECTURE SUMMARY

```
LLM
 │ emits JSON string
 ▼
SpecRootSchema.safeParse(json)       ← Zod validation (boundary)
 │ success: SpecRoot
 │ failure: error state, do not render
 ▼
useDeclaredState(spec.state)         ← instantiates reducer from declarations
 │
 ▼
renderNode(spec.root, ctx, "root")   ← recursive interpreter
 │ for each node:
 │   1. Look up entry = registry[node.type]
 │   2. entry.propsSchema.safeParse(nodeProps)  ← validate props
 │   3. Recursively render children/slots
 │   4. Wrap in ErrorBoundary
 │   5. React.createElement(entry.component, validatedProps, children)
 ▼
React tree of @nauta/ui components
```

```
ActionRegistry (host-provided)
  "confirm-field" → tRPC mutation
  "deny-field"    → tRPC mutation
  "autofill"      → tRPC mutation

DataBindings (host-provided)
  "email.subject" → string
  "email.status"  → string
  "data.items"    → Array<EmailComponent>
```

---

## 9. PHASE-SPECIFIC WARNINGS / PITFALLS

### Pitfall 1: z.discriminatedUnion + z.lazy recursion breaks TypeScript inference

Zod's `z.discriminatedUnion` cannot infer types through `z.lazy()` barriers. The circular
reference forces you to annotate the children array explicitly:

```typescript
const ChildrenSchema: z.ZodType<SpecNode[]> = z.lazy(() => z.array(SpecNodeSchema));
```

Without the explicit `z.ZodType<SpecNode[]>` annotation, TypeScript infers `ZodLazy<...>`
which doesn't satisfy the `ZodType` constraint in `SpecNodeSchema`. This is a known Zod v3
limitation; Zod v4 improves recursive inference but still requires explicit annotation for
discriminated union recursion.

Source: https://github.com/colinhacks/zod/issues/4783

### Pitfall 2: LLM generates unknown `type` values

The LLM may hallucinate a component name (e.g., `"type": "data-table"` when the registry
only has `"grid"`). Always handle the missing-registry-entry case with a safe fallback,
not a thrown error or `undefined` component.

### Pitfall 3: Unstable keys on spec regeneration

If you ask the LLM to include stable `id` fields in nodes and use them as React keys,
the LLM will generate random UUIDs that change between generations. Use structural position
keys (`${keyPrefix}-${index}`) which are deterministic from tree structure.

### Pitfall 4: `dataRef` paths that don't exist

When `resolveDataRef("data.invoice.total", ctx)` is called but `ctx.data.invoice` is
undefined, the resolver returns `undefined`. The `ConditionalNode` and `ListNode`
interpreters must handle `undefined` data gracefully:
- List with undefined dataRef → render emptyState or nothing
- Conditional with undefined dataRef → treat as falsy, render `else` branch

### Pitfall 5: Actions that fire before data is loaded

A button with `action: "confirm-field"` may fire while tRPC is still loading the entity
data. The ActionRegistry handler should check loading state and no-op if not ready. The
spec cannot model this guard — it must be in the handler itself.

### Pitfall 6: Hydration mismatch if spec is server-generated

If `SpecRenderer` is inside an RSC that passes the spec as a prop to a `"use client"`
island, and the spec contains any non-deterministic content (timestamps, random IDs), the
server and client will diverge. Keep the spec fully static if server-rendering, or render
the island purely client-side via `dynamic(import('./SpecRenderer'), { ssr: false })`.

### Pitfall 7: Memory leak from Jotai atomFamily

If using `atomFamily` for per-node state, call `family.remove(keyPrefix)` when a node
is removed from the spec (e.g., when the spec is regenerated and a structural position
disappears). Use `family.setShouldRemove()` with a cleanup policy.

Source: https://jotai.org/docs/utilities/family

### Pitfall 8: Manifest propsSchema not kept in sync with component

If a component's actual React props diverge from its `propsSchema` (e.g., a component is
refactored to accept `size: "sm" | "md"` but `propsSchema` still has `size: z.enum(["sm","md","lg"])`),
the LLM may emit valid spec nodes that the component rejects at runtime. The CI test in
§4.3 catches this. Run it.

---

## 10. SOURCES

| Source | Confidence | What it informs |
|--------|------------|-----------------|
| https://adaptivecards.io/explorer/ | HIGH | Schema versioning, `type` discriminator, `fallbackText` pattern |
| https://puckeditor.com/blog/puck-019 | HIGH | Slots API: children-in-props, portable subtrees |
| https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5 | HIGH | Registry lookup, declarative actions, discriminated union rendering |
| https://github.com/divkit/divkit | MEDIUM | Variable declaration at root, template expressions (surveyed, not adopted) |
| https://jsonforms.io/docs/ | HIGH | Renderer registry tester pattern, data+ui schema separation |
| https://www.copilotkit.ai/blog/a2ui-whats-new-in-google-generative-ui-spec | MEDIUM | Catalog negotiation, flat-vs-nested comparison |
| https://getwireai.com/ | HIGH | `name+description+propsSchema+component` manifest shape; Zod validation before render |
| https://github.com/colinhacks/zod/issues/4783 | HIGH | z.lazy + discriminatedUnion recursion gotcha |
| https://github.com/colinhacks/zod/discussions/3477 | HIGH | Recursive discriminated union pattern with explicit type annotation |
| https://ryanschiang.com/zod-nested-discriminated-union | HIGH | .options merge pattern for nested discriminated unions |
| https://jotai.org/docs/utilities/family | HIGH | atomFamily for per-node state; memory leak warning |
| https://runharbor.com/blog/2025-10-26-improving-deeply-nested-react-render-performance-with-jotai-atomic-state | MEDIUM | atomFamily per-node performance pattern in deeply nested trees |
| https://dev.to/serifcolakel/building-a-cost-efficient-generative-ui-architecture-in-react-native-2d58 | MEDIUM | GenUIComponent enum registry, PickComponent switch, Zod validation |
| Local: packages/ui/src/spreadsheet-grid/column-defs.ts | HIGH | Primary local precedent: type-keyed registry, switch-based renderer dispatch |
| Local: packages/ui/src/spreadsheet-grid/types.ts | HIGH | SchemaFieldType discriminated union, readonly prop house style |
