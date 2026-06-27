# Prior Art: Runtime Spec-First Generative UI Engine

**Research date:** 2026-06-26  
**Scope:** Runtime generation of web UI from constrained component vocabulary via LLM, rendered without eval, with spec caching/template promotion.  
**Host context:** Next.js 14 App Router, React 18, TypeScript strict, `@nauta/ui` (shadcn/Radix, ~40 components + schema-driven spreadsheet-grid), tRPC + TanStack Query, Drizzle + Supabase/pgvector, AWS Bedrock (Claude + Titan embeddings).

---

## Reference 1: Vercel `json-render` (vercel-labs/json-render)

**What it is:** A generative UI framework released January 2026, Apache-2.0, ~13k GitHub stars. Described as "AI → JSON → UI." The closest existing system to what we want to build.

**Core architecture — Catalog / Spec / Registry / Renderer:**

- **Catalog** (your vocabulary contract): defined with `defineCatalog()` + Zod schemas. Declares which components exist, their prop types, named slots, and typed action bindings. The LLM is constrained to this catalog — it cannot reference anything outside it.
- **Spec** (what the LLM emits): a flat JSON tree:
  ```json
  {
    "root": "card-1",
    "elements": {
      "card-1": {
        "type": "PetCard",
        "props": { "petId": "abc", "name": "Rex" },
        "children": ["badge-2"],
        "on": { "click": { "action": "navigate", "params": { "to": "/pets/abc" } } }
      }
    }
  }
  ```
  Elements reference each other by ID (flat, not nested). Supports dynamic binding directives: `$state`, `$cond`, `$template`, `$computed`.
- **Registry**: maps catalog type names to platform implementations (React, Vue, Svelte, Solid, React Native). Decoupled from catalog — the same catalog can target multiple renderers.
- **Renderer** (`<SpecRenderer>`): wraps output in four providers — StateProvider, VisibilityProvider, ActionProvider, ValidationProvider. No eval; pure structural instantiation via registry lookup.

**Streaming:** Uses SpecStream — a JSONL protocol where each line is an RFC 6902 JSON Patch operation. `createSpecStreamCompiler<MySpec>()` accumulates patches progressively. The `useUIStream` hook wraps this with React state. `push(chunk)` returns current accumulated spec + new patches. The React `<Renderer>` reflects changes immediately as each patch arrives.

**AI SDK integration:** Works with Vercel AI SDK's `streamText` on the server side. Catalog Zod schemas become the tool/structured-output schema. Ships 36 pre-built shadcn/ui components.

**Template caching:** No dedicated template library or spec promotion system is documented. Catalogs are static definitions, not retrieved specs. Template caching would need to be layered on top.

**License:** Apache-2.0.

**What to steal:**
- The Catalog → Spec → Registry three-layer separation is the definitive pattern — adopt it exactly.
- Flat element tree with ID references (not nested JSON) is crucial: LLMs produce more stable output with flat structures, and partial patches via SpecStream remain well-formed as they arrive.
- JSON Patch (RFC 6902) as the streaming wire format — each line is atomic and independently applicable.
- `$state`/`$cond`/`$template`/`$computed` expression directives in props: these enable stateful, conditional UI without a second generation call.
- Zod schemas on the catalog side double as both the LLM constraint and the runtime prop validator — one source of truth.

**What to avoid:**
- Their pre-built shadcn component catalog uses their naming conventions; we need to map our `@nauta/ui` exports to our own catalog names.
- No built-in template promotion / vector retrieval — we must add this for the "flywheel" caching layer.
- The StateProvider/VisibilityProvider abstraction adds complexity; for our domain we can start simpler (static spec, no runtime state mutation).

**Sources:**
- https://github.com/vercel-labs/json-render
- https://json-render.dev/docs
- https://json-render.dev/docs/streaming
- https://infoq.com/news/2026/03/vercel-json-render/

---

## Reference 2: Google A2UI (Agent-to-User Interface Protocol)

**What it is:** An open protocol released December 2025 (Apache-2.0), v0.9 in April 2026. Positions itself as a *protocol* for cross-agent, cross-framework, cross-platform UI generation — analogous to what OpenAPI is for REST. Backed by Google, adopted by Oracle, with integrations for Web Components, Flutter, Angular, React Native.

**Core architecture:**

A2UI separates three concerns:
- **Agent side:** emits a declarative component tree (flat list of components with ID references) referencing only catalog-registered types. "A declarative data format, not executable code."
- **Catalog / capability negotiation:** the client advertises which component types it supports (its catalog). The agent only requests types in this catalog. Unknown types degrade gracefully.
- **Client renderer:** maps the abstract A2UI spec to native widgets. The client maintains full control and can integrate into branded UX. Supports Web Components natively.

**Spec format:** flat JSONL (one component node per line, streaming). Each node: `{ id, type, props, children: [id…] }`. Incremental: agents can emit patches to previously streamed nodes ("efficiently make incremental changes to the UI based on new user requests").

**Transport-agnostic:** A2UI payloads can be sent over A2A (Google's Agent-to-Agent protocol), CopilotKit AG-UI, or HTTP/SSE. This is the key architectural difference from json-render: A2UI is a *protocol specification*, not an opinionated implementation.

**Security:** Component catalog is the security boundary. No eval. Props are typed by catalog schemas.

**Template / caching:** Not addressed in public docs as of April 2026.

**What to steal:**
- The *protocol vs. tool* distinction. A2UI's insight that the spec format should be transport-agnostic and framework-agnostic is correct even for a single-tenant system — it keeps the LLM output decoupled from the React rendering layer.
- Capability negotiation concept: the client advertises what it can render. For our case, the catalog IS our advertised capability, and we can version it.
- Graceful degradation for unknown types: our renderer should have a `FallbackComponent` for unknown type names rather than throwing.
- Incremental node streaming via JSONL (same insight as json-render's SpecStream, independently validated by both Google and Vercel).

**What to avoid:**
- A2UI's cross-platform scope introduces protocol overhead we don't need (Web Components, Flutter, etc.). We are React-only.
- The "protocol not implementation" stance means there's no React renderer to drop in — we'd build our own.

**Sources:**
- https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/
- https://www.analyticsvidhya.com/blog/2025/12/google-a2ui-explained/
- https://a2ui.sh/articles/introduction-to-a2ui

---

## Reference 3: Tambo (tambo-ai/tambo)

**What it is:** A React SDK + backend for generative UI. Open-source (MIT for SDK), with Tambo Cloud managed backend or self-hosted Docker. Positions as "Generative UI SDK for React" where AI agents autonomously select and stream props to registered components.

**Core architecture:**

- **Component registration with Zod:** Components registered as `{ name, description, component, propsSchema: z.object({…}) }`. The `description` field is critical — it's what the LLM uses for semantic component selection.
- **Agent-as-selector:** The LLM sees component schemas as *tool definitions*. It autonomously selects the best-matching component based on natural language intent + description. This is agentic selection, not rule-based dispatch.
- **Props streaming:** Tambo streams props progressively as the LLM generates them. The UI renders with partial props and hydrates as more arrive — users interact with components while they're still generating.
- **Two component patterns:**
  - `GenerativeComponent`: rendered once per message (charts, summaries, data cards).
  - `InteractableComponent` (via `withTamboInteractable` wrapper): persists across conversation turns, updated by ID.
- **Thread model:** `useTambo()` provides messages array; each message contains `renderedComponent`. `useTamboThreadInput()` manages submission. Backend maintains conversation state.
- **MCP integration:** External systems (Linear, Slack, databases) connected via Model Context Protocol over HTTP.

**Deployment:** Tambo Cloud (managed) or self-hosted Docker with identical backend logic.

**Template caching:** No explicit template library or semantic retrieval documented.

**What to steal:**
- The `description` field on component registrations feeding LLM selection. For our catalog, each component entry should include a semantic description field that is injected into the LLM prompt as guidance.
- Interactable vs. generative distinction: some of our generated UIs are one-shot (display a form), others need to persist and update (an entity canvas).
- Props streaming pattern: render with partial props, hydrate as generation completes. Avoids blank-screen wait.
- The self-hosted pattern is compatible with our Bedrock IAM-role setup (no external API keys needed).

**What to avoid:**
- Tambo's agent selects from the full component registry on every request — fine for small registries, but for 40+ components the LLM needs guidance (layout context, request type) to avoid picking poorly. We need a pre-filtering / retrieval step.
- Their backend is opaque even in self-hosted mode; we'd rather own the full pipeline (Bedrock tool_use → spec → render).

**Sources:**
- https://github.com/tambo-ai/tambo
- https://docs.tambo.co/
- https://www.yuv.ai/blog/tambo-ai

---

## Reference 4: Airbnb Ghost Platform (SDUI)

**What it is:** Airbnb's production server-driven UI system, covering a majority of their most-used features (search, listing pages, checkout) across iOS, Android, and Web. Published in 2021 tech blog post. The canonical example of SDUI at consumer scale.

**Core architecture:**

- **Single shared GraphQL schema** for all three platforms. Schema evolution is the source of truth, not client code.
- **Three element types:**
  - `Sections`: independent UI groups; contain pre-translated/formatted data. Keyed by `SectionComponentType`. Decoupled from context around them — reusable.
  - `Screens`: layout definitions specifying where/how sections appear. `LayoutsPerFormFactor` handles compact vs. wide breakpoints.
  - `Actions`: `IAction` interface for user interactions; routed to feature-specific event handlers. Generic actions (navigate, scroll) handled universally.
- **Rendering pipeline:** Server sends `GPResponse { sections[], screens[] }`. Client iterates `SectionDetail` objects, looks up section data by ID, instantiates pre-built component for that `SectionComponentType`. Type-safe, deterministic, no eval.
- **Section component contract:** Each section component maps exactly one `SectionComponentType` to one rendering. Components are "configurable, styleable, and backward compatible." This is our "registry" concept.
- **No template caching documented** — server generates fresh responses per request.

**Lessons at scale:**
- Centralizing business logic on the backend removed 3x platform duplication.
- Section independence enables reuse across different screen contexts without tight coupling.
- Version independence solves the mobile app update problem (for us: enables hot-updating generated UIs without deploy).
- Strongly typed models across all platforms — the GraphQL schema is the contract.

**What to steal:**
- The `SectionComponentType` as a registry key pattern — exactly what our `catalog.components` keys are.
- Section independence principle: each generated component in our spec should be self-contained (its data pre-fetched/inlined), not reliant on sibling context.
- Screen / section separation: the spec describes WHAT components appear; a separate layout config describes WHERE. For our use case this maps to: spec = component tree + props; layout = column/row/grid wrapper (could be a catalog component itself).
- The "backward compatible" section component design: when we add a new catalog component, existing specs that don't use it still work perfectly.

**What to avoid:**
- GraphQL as the spec transport is heavyweight for our use case; our spec is simpler (flat JSON element tree is sufficient).
- Airbnb's system requires "core" section components maintained by a platform team — for us, `@nauta/ui` exports are the core set, and we need a low-friction registration path.

**Sources:**
- https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5
- https://www.infoq.com/news/2021/07/airbnb-server-driven-ui/

---

## Reference 5: assistant-ui — `MessagePrimitive.GenerativeUI`

**What it is:** A React chat UI library (Y Combinator W25), TypeScript/React, open-source, 50k+ monthly downloads. Provides a first-class `MessagePrimitive.GenerativeUI` primitive for spec-driven component rendering within chat message streams.

**Core architecture:**

- **Component allowlist (registry):** Consumer provides `{ ComponentName: ReactComponent }` map. The renderer looks up names in this map only. Unknown names throw `GenerativeUIRenderError` or invoke a `Fallback` component. No dynamic imports, no eval.
- **Spec format (tree, not flat):**
  ```typescript
  type GenerativeUINode = string | {
    component: string;
    props?: Record<string, unknown>;
    children?: GenerativeUINode[];
    key?: string;
  };
  type GenerativeUISpec = { root: GenerativeUINode | GenerativeUINode[] };
  ```
  Bare strings are text leaves. Allows mixed text + component compositions in a message.
- **Security posture:** Props spread directly onto allowlisted components without validation. Docs explicitly warn to treat every allowlisted component as receiving untrusted input and to avoid `dangerouslySetInnerHTML`, validate `href`/`src`. This is the right security stance.
- **Streaming:** Native `generative-ui` message parts support incremental updates via ExternalStore. AI SDK bridge maps a dedicated `render_gui` tool result to the renderer (complete spec at tool completion, not progressive).
- **Integration:** Composes with text, tool calls, and reasoning in single messages via `MessagePrimitive.Parts`.

**What to steal:**
- The `Fallback` component pattern for unknown names — graceful degradation that shows a placeholder instead of crashing.
- The explicit security warning about treating allowlisted component props as untrusted: we must validate critical props (especially URLs/hrefs) at the component level, not the spec level.
- The bare-string text leaf in the tree enables mixed text/component specs — useful for our document review surfaces where LLM output blends narrative and structured UI.
- The Y Combinator backing and adoption numbers confirm this is a production-viable pattern.

**What to avoid:**
- Tree structure (vs. flat): assistant-ui uses a nested tree which can produce malformed partial output during streaming (you can't apply a child patch before the parent arrives). json-render's flat + JSON Patch approach is superior for streaming.
- The AI SDK `render_gui` bridge returns a complete spec only at tool completion — no progressive rendering. We want patch-based streaming.

**Sources:**
- https://www.assistant-ui.com/docs/tools/generative-ui
- https://github.com/assistant-ui/assistant-ui

---

## Reference 6: Vercel AI SDK — `streamUI` / RSC / `useObject` / `generateObject`

**What it is:** The Vercel AI SDK provides multiple patterns for structured/generative UI. Two generations exist: the RSC-based approach (ai/rsc, `streamUI`, `createStreamableUI`) — **now paused/deprecated for production** — and the current AI SDK UI approach (`useObject`, `generateObject`, `streamObject`).

**RSC / streamUI (deprecated path):**
- Server-side: `streamUI()` maps LLM tool calls to React Server Components streamed to the client. `createStreamableUI` creates a streamable RSC handle. `createStreamableValue` streams structured data.
- The LLM selects a tool → the tool's `render` async generator yields RSC nodes → streamed via RSC wire protocol.
- **Status: development paused.** Vercel now recommends AI SDK UI for production. The RSC approach had issues with replay, suspense boundaries, and framework coupling.

**Current path — `generateObject` / `streamObject` / `useObject`:**
- `generateObject(schema: ZodSchema)` → returns a validated object conforming to the schema.
- `streamObject(schema: ZodSchema)` → streams partial objects as they generate.
- `useObject({ schema, api })` hook → React hook that streams object generation to the client.
- These do NOT stream React components — they stream structured data that *your code* then renders.
- This is the correct primitive for our use case: `streamObject` with our Spec schema → `useUIStream` renders the accumulated spec.

**What to steal:**
- `streamObject` is the right transport primitive for our Bedrock integration. AWS Bedrock now supports structured outputs via JSON Schema (GA February 2026). We use `streamObject` (or equivalent Bedrock `InvokeModelWithResponseStream` + structured output) to generate the Spec.
- The tool-call-to-component mapping concept from streamUI is still architecturally valid — we adapt it by having the LLM emit a full Spec as a single structured output instead of per-turn tool calls.

**What to avoid:**
- Do not use `ai/rsc` / `streamUI` / `createStreamableUI`. Paused, fragile, requires Next.js RSC in specific ways, poor DX for iterative updates.
- Do not build around RSC streaming for component trees — the RSC wire format is not stable/inspectable and cannot be cached as a reusable spec.

**Sources:**
- https://vercel.com/blog/ai-sdk-3-generative-ui
- https://ai-sdk.dev/docs/introduction
- https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces

---

## Reference 7: Vercel v0 + shadcn Registry Distribution Model

**What it is:** v0 is Vercel's code-generation tool (LLM → shadcn/ui React code). The shadcn *registry* is the distribution mechanism: a spec format for sharing component source code, hooks, config files, and metadata via `registry.json` + per-component `/r/{name}.json` endpoints.

**Registry distribution model:**
- `registry.json` at repo root declares all items; each item has: `name`, `type` (component/block/hook/etc.), `files` array (path + content), `dependencies`, `devDependencies`, `tailwind.config`, `cssVars`.
- `/r/{name}.json` serves the individual item — `shadcn add <url>` fetches it and copies source into the consuming project.
- v0 integration: `"Open in v0"` passes the registry URL to v0.dev as context. v0 receives the component source and metadata, uses it to constrain generation to the team's design system.
- The registry is a *distribution spec*, not a *render spec*. It describes source code to copy, not a runtime tree to render.

**AI-native design system pattern:**
- The key insight: models need to understand how components are structured, styled, and relate to each other. A well-documented registry gives v0 that context.
- Registries make components "model-consumable": the `/r/{name}.json` format includes enough metadata for an LLM to generate instances without hallucinating props.

**What to steal:**
- Our `@nauta/ui` already follows this pattern. The registry format is the bridge between "component exists in codebase" and "LLM knows how to use it."
- For our catalog, we should generate a machine-readable manifest from `@nauta/ui` exports (component name → Zod prop schema → usage example) analogous to registry items. This manifest feeds the catalog.
- The `"Open in v0"` → `/r/{name}.json` flow is our analog for "promote spec to template library" — store the full Spec JSON at a retrievable endpoint tagged with semantic metadata.

**What to avoid:**
- v0 generates raw source code (JSX/TSX). We do not want code generation — we want spec generation. The registry is useful as a *catalog population mechanism*, not as the generation target.
- Don't try to run v0 as a backend service; it's a Vercel-hosted product.

**Sources:**
- https://ui.shadcn.com/docs/registry
- https://vercel.com/academy/shadcn-ui/what-is-a-component-registry
- https://v0.app/docs/design-systems

---

## Reference 8: Thesys C1 / GenUI

**What it is:** A commercial product (founded 2024, San Francisco). C1 is an API middleware that sits between your LLM backend and your React frontend. It returns a DSL instead of plain text, which the C1 React SDK renders as interactive components.

**Architecture:**
- Drop-in replacement for OpenAI API endpoint (`https://api.thesys.dev/v1/embed`). Supports Claude models via `c1/anthropic/claude-sonnet-4/v-20250815`.
- Backend transforms LLM output into a proprietary DSL (not publicly documented in detail). The DSL encodes component intents (forms, charts, tables, lists).
- `<C1Component content={response} />` wrapped in `<ThemeProvider>`: renders DSL as "live micro-frontends."
- `isStreaming` prop toggles progressive rendering during transmission.
- `onAction` callback routes user interactions back to conversation turns with `{ llmFriendlyMessage, humanFriendlyMessage }`.

**What to steal:**
- The `onAction` callback with dual output (`llmFriendlyMessage` / `humanFriendlyMessage`) is elegant for closing the agent loop: component interactions emit machine-parseable events back to the LLM AND human-readable messages to the UI.
- The middleware pattern (intercept LLM output, transform to DSL, render) is architecturally clean; but since we want the LLM to directly emit our Spec (constrained by Bedrock structured output), we skip the middleware layer.

**What to avoid:**
- Proprietary DSL = vendor lock-in. We publish our own Spec schema.
- No visibility into how components are registered or extended. Black box.
- Commercial pricing, no self-hosted option.

**Sources:**
- https://docs.thesys.dev/guides/migrate-to-genui
- https://dev.to/anmolbaranwal/thesys-react-sdk-turn-llm-responses-into-real-time-user-interfaces-30d5
- https://abduzeedo.com/thesys-generative-ui-c1-api

---

## Reference 9: Puck (@measuredco/puck)

**What it is:** Open-source (MIT) visual editor for React. Every edit is a change to a JSON tree where each node matches the props of a real React component. No code generation — pure data → render.

**Architecture:**
- **Config object:** `{ components: { ComponentName: { fields: {…}, render: (props) => JSX } } }` — the registry.
- **Data model:** JSON tree of component instances with `{ type, props }` nodes. Exported/persisted as plain JSON. The `<Render config data />` component renders the saved JSON without the editor.
- **Editor vs. Renderer:** `<Puck>` is the drag-drop editor; `<Render>` is the read-only renderer. Same config, different UX modes.
- **Serialization:** Pages export as clean, migration-friendly JSON schema.
- **No AI generation built-in** — but the data model is exactly what an AI would need to emit.

**What to steal:**
- The config `{ fields, render }` structure per component is a minimal but complete registry entry. Our catalog should similarly declare: props schema (Zod), optional field hints for the editor surface, and the render component.
- The `<Render config data />` separation is the correct pattern: the interpreter (Renderer) only needs the config + data — it has no knowledge of how data was produced (human editor vs. AI generation). This separation is key for our "trusted interpreter" requirement.
- Puck's JSON schema is stable enough that Puck itself can recreate full state from it — evidence that a flat-ish component tree JSON is round-trippable. Store this JSON as your template.

**What to avoid:**
- Puck's field type system is designed for human editors (drag-drop). Our catalog prop schemas are for LLM generation — they need descriptions, examples, and constraints that field editors don't require.
- Puck's rendering is synchronous/static — no streaming, no progressive hydration.

**Sources:**
- https://github.com/puckeditor/puck
- https://dev.to/measuredco/building-a-react-page-builder-an-introduction-to-puck-2pgi

---

## Reference 10: JSONForms / react-jsonschema-form (RJSF) — Schema-Driven Form Architecture

**What it is:** Two mature projects (JSONForms by EclipseSource; RJSF by the rjsf-team) that render HTML forms from JSON Schema + a separate UI Schema. The canonical "schema-driven rendering" pattern for forms.

**Architecture (JSONForms):**
- **Data schema** (JSON Schema Draft 7): describes the data shape, types, constraints.
- **UI schema**: describes presentation — layout, widget selection, ordering, custom renderers.
- **Renderer registry:** `{ tester: (uiSchema, schema) => priority, renderer: ReactComponent }`. JSONForms picks the highest-priority matching renderer. Testers are composable.
- **Custom renderers:** You register component implementations for specific UI schema types. The registry pattern means adding new field types doesn't require modifying existing renderers.
- **RJSF additions (v6):** `ui:definitions` for reusable UI schema fragments. Dynamic uiSchema for array items via function. `ui:widget` maps to custom widget components.

**What to steal:**
- The **tester-based renderer selection** (tester returns a numeric priority, highest wins) is more flexible than exact-match registry lookup. For our system: if an element type isn't in the catalog, a tester with priority 0 can return a generic placeholder renderer.
- The **data schema + ui schema separation** maps to our situation: our Zod prop schema is the data schema; the catalog entry's rendering hints (layout, variant) are the ui schema equivalent.
- The `ui:definitions` reuse mechanism — exactly the "template library" concept. A stored definition can be referenced by `$ref` in the UI schema. Our template library can work the same way: stored named sub-specs that generated specs can reference.

**What to avoid:**
- JSONForms/RJSF are form-only. The renderer registry is rich for form widgets but has no concept of layout composition or component nesting beyond form fields.
- The dual-schema pattern (data + ui) adds indirection that for our use case is absorbed into the single Zod prop schema on the catalog entry.

**Sources:**
- https://jsonforms.io/docs/architecture
- https://rjsf-team.github.io/react-jsonschema-form/
- https://jsonforms.io/docs/tutorial/custom-renderers

---

## Reference 11: Plasmic — Code Component Registration

**What it is:** Visual builder for React (SaaS + open-source host). Its "code components" pattern — registering your own React components into Plasmic Studio — is the most mature prior art for "designer/AI configures your real components."

**Registration API:**
```typescript
registerComponent(MyComponent, {
  name: "MyCard",
  displayName: "Card",
  props: {
    title: "string",
    variant: { type: "choice", options: ["primary", "secondary"] },
    onClick: { type: "eventHandler", argTypes: [] },
    content: { type: "slot" },
    showHeader: {
      type: "boolean",
      hidden: (props) => !props.title,  // conditional visibility in studio
    }
  },
  defaultStyles: { padding: "16px" }
});
```

**Architecture:**
- Studio stores the visual design as a JSON tree of element instances: `{ type: "component", name: "MyCard", props: { title: "…" } }`.
- Slots contain nested element trees following the same structure.
- `PlasmicComponent` or codegen renders this JSON tree against the registered component map.
- Prop control functions `(props, ctx) => value` enable dynamic studio UI — a prop's visibility or options can depend on other prop values. This is the "conditional schema" concept.

**What to steal:**
- The `hidden: (props) => !props.title` conditional prop visibility pattern: in our catalog, some prop combinations don't make sense. The catalog entry can declare conditional relevance, which helps the LLM avoid invalid prop combos (injected into the system prompt as rules).
- The `slot` type: named children areas. Our catalog can declare `slots: ["header", "body", "footer"]` for layout components. The LLM fills slots with nested component subtrees.
- The JSON element tree structure: `{ type, name, props, children: [element…] }` maps directly to our Spec format.
- The "application-hosted Plasmic" model (Plasmic runs as kernel inside your app) is the architecture we want: our Renderer runs inside Next.js, our catalog is defined in the monorepo.

**What to avoid:**
- Plasmic's Figma-to-component import is irrelevant; we're LLM-driven.
- Their Studio is a SaaS product with commercial pricing for the editor surface.
- The `prop control functions` are runtime-evaluated in their Studio context — we need a serializable/static version for our catalog descriptions fed to the LLM.

**Sources:**
- https://docs.plasmic.app/learn/registering-code-components/
- https://docs.plasmic.app/learn/code-components-ref/

---

## Reference 12: DivKit (Yandex) — SDUI with Templates + Expression Language

**What it is:** Open-source (Apache-2.0) cross-platform SDUI framework by Yandex. Production-scale: powers Yandex Search, Maps, Alice assistant. Supports iOS, Android, Web, Flutter. JSON-schema-defined spec with a real expression language.

**Architecture:**
- **JSON spec structure:** `{ "card": { "log_id": "…", "states": [{ "state_id": 0, "div": { "type": "div_container", "items": […] } }] } }`. Hierarchical, not flat.
- **Component types:** `div_container`, `div_text`, `div_image`, `div_grid`, `div_gallery`, `div_tabs`, `div_state` (for visibility toggling), `div_custom` (for platform extensions).
- **Expression language:** `@{variable_name}` for runtime data binding. Variables declared in `"variables": [{ "name": "count", "type": "integer", "value": 0 }]`. Expressions evaluated natively on each platform.
- **Templates:** `"templates": { "my_template": { "type": "div_text", "$text": "title" } }`. Templates reduce payload size dramatically. `"$text": "title"` means "bind this field from the parent's `title` prop." Template inheritance supported.
- **Actions:** `div-action` with `url: "div-action://…"` scheme for custom handlers, or standard navigate/set-variable/animate.
- **Patches:** `Element Patches` allow dynamic updates to individual nodes without re-sending the full card.
- **Timers and triggers:** For complex animations and timed state changes.

**What to steal:**
- **Template system** is the closest existing implementation to our "template library" concept. DivKit's `"templates"` block defines reusable sub-trees that cards can reference. For our spec, a similar `"templates"` block lets the LLM reference pre-approved sub-specs by name — the flywheel: human-promoted good outputs become named templates the LLM can invoke.
- **Expression language** (`@{var}`) shows how to do runtime data binding without eval. Our `$state` directives in json-render serve the same purpose.
- **Element patches** are the SDUI ancestor of json-render's SpecStream JSON Patch. The concept of incremental updates to a live spec is battle-tested at Yandex scale.
- **`div_state`** for conditional rendering: a component that switches between named child states based on variable values. This is what our `$cond`/visibility directives implement.

**What to avoid:**
- DivKit's spec is deeply hierarchical (nested objects, not flat). LLMs produce more consistent output with flat structures (validated by both json-render and A2UI designs).
- The expression language is custom and platform-implemented. We prefer JSON binding directives ($state, $cond) that are pure data.
- Not React-native — the web implementation exists but the primary targets are iOS/Android native.

**Sources:**
- https://divkit.tech/en/
- https://github.com/divkit/divkit
- https://medium.com/yandex/yandex-releases-divkit-an-open-framework-for-server-driven-ui-cad519252f0f

---

## Reference 13: Microsoft Adaptive Cards

**What it is:** An open card-exchange format (Apache-2.0) for cross-platform, cross-application structured UI. Used in Microsoft Teams, Outlook, Bot Framework, Copilot extensibility. The oldest and most widely deployed "declarative JSON → native UI" system.

**Architecture:**
- **JSON schema (v1.x):** `{ "type": "AdaptiveCard", "version": "1.5", "body": [{ "type": "TextBlock", "text": "…" }, { "type": "ColumnSet", "columns": […] }], "actions": [{ "type": "Action.Submit", "title": "OK" }] }`.
- **Element types:** TextBlock, Image, ColumnSet/Column, FactSet, ActionSet, Input.Text/Number/Date/ChoiceSet, etc. Fixed vocabulary, no extension mechanism for custom components (a long-standing limitation).
- **HostConfig:** Platform-specific styling configuration — fonts, colors, spacing — applied by the renderer. The card spec is styling-agnostic; HostConfig adapts it to each host.
- **Versioning + fallback:** Cards declare `"version"`. Renderers that don't support a version render `"fallbackText"`. `"fallback"` property on elements for graceful degradation.
- **Action.Execute (Universal Actions, v1.4+):** Actions invoke backend handlers, returning updated cards for in-place refresh.

**What to steal:**
- **HostConfig pattern:** a separate styling configuration that the renderer applies. For our system: the catalog is the HostConfig equivalent — it maps abstract component names to `@nauta/ui` implementations + default styling. The Spec is styling-agnostic; the catalog provides the look.
- **Schema versioning + fallback** is a must-have for any long-lived spec system. Our Spec should carry a `"$version"` field, and our renderer should have graceful fallback for unsupported element types.
- **Action.Execute → updated card refresh**: exactly our "region edit ops" pattern. A button in the generated UI triggers a backend action, returns an updated Spec, re-renders in place.

**What to avoid:**
- Adaptive Cards' fixed vocabulary (no custom components) is the primary architectural flaw for our use case — we need to register our own `@nauta/ui` components.
- The spec is hierarchical (nested body arrays). Same streaming flaw as DivKit.
- The web JavaScript SDK is aging; the ecosystem is Microsoft-ecosystem-centric.

**Sources:**
- https://adaptivecards.io/
- https://learn.microsoft.com/en-us/adaptive-cards/rendering-cards/implement-a-renderer

---

## Reference 14: Craft.js — Editable JSON State

**What it is:** Open-source React framework for building drag-drop page editors. Not a complete editor — a framework for building editors. MIT license.

**Architecture:**
- **Resolver:** `{ ComponentName: ReactComponent }` map — the registry.
- **EditorState:** serializable JSON tree of component instances. `craft.js` can recreate full editor state from JSON.
- **Editor vs. Render split:** `<Editor resolver={…}>` for editing; separate render path for viewing.
- **Node structure:** each node has `{ type, props, isCanvas, nodes: [id…], linkedNodes: {} }`.
- **State management:** Redux-like store with time-travel (undo/redo) built in.

**What to steal:**
- The `resolver` as a named map — identical to our registry. The naming shows this is the right vocabulary.
- The `isCanvas` flag distinguishes container nodes (which can have children) from leaf nodes. Our catalog should declare `acceptsChildren: boolean` per component type.
- JSON round-trip fidelity: Craft.js guarantees that `JSON.parse(JSON.stringify(editorState))` produces valid input. We need the same guarantee for our Spec.

**What to avoid:**
- Craft.js is built for human interaction — its state machine is optimized for drag-drop events, not streaming AI output patches.
- No streaming, no progressive rendering.
- Maintenance concerns: the repo has been slow to release major updates.

**Sources:**
- https://github.com/prevwong/craft.js
- https://craft.js.org/docs/overview

---

## Reference 15: CopilotKit AG-UI Protocol

**What it is:** An open, lightweight, event-based protocol that standardizes real-time bidirectional communication between AI agents and user-facing applications. Adopted by Google (A2UI transport), LangGraph, CrewAI, LlamaIndex, Pydantic AI, AWS, Microsoft.

**Architecture:**
- **17 typed event types** transmitted over SSE/WebSocket: message lifecycle (`TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`), tool calls (`TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`), state updates (`STATE_SNAPSHOT`, `STATE_DELTA`), lifecycle signals (`RUN_STARTED`, `RUN_FINISHED`, `ERROR`), generative UI (`GENERATIVE_UI_START`, `GENERATIVE_UI_CONTENT`, `GENERATIVE_UI_END`).
- **Generative UI events:** `GENERATIVE_UI_START` carries `componentName`; `GENERATIVE_UI_CONTENT` carries incremental props; `GENERATIVE_UI_END` signals completion. This maps directly to our streaming Spec pattern.
- **Bi-directional:** User interactions can be sent back to the agent as typed events, closing the loop.
- **`useAgent` hook (v1.50+):** single hook that connects any AG-UI-compatible agent backend to a React frontend.

**What to steal:**
- The **generative UI event subset** (`GENERATIVE_UI_START/CONTENT/END`) is a more structured alternative to raw JSONL SpecStream patches. Consider adopting this event schema for our streaming transport — it's gaining cross-vendor adoption.
- The **typed event stream** model means our renderer subscribes to events, not polling. Events carry enough context (`componentName`, incremental props) to render progressively without accumulating a full spec first.
- AG-UI is transport-agnostic (SSE or WebSocket) — compatible with our Next.js API routes.

**What to avoid:**
- Full AG-UI adoption would require implementing 17 event types and a compatible backend. Overkill for v1; consider for v2 when multi-agent orchestration matters.

**Sources:**
- https://www.copilotkit.ai/ag-ui
- https://deepwiki.com/CopilotKit/CopilotKit/6-ag-ui-protocol

---

## Reference 16: AWS Bedrock Structured Outputs

**What it is:** Native JSON Schema structured output support for Amazon Bedrock (GA February 2026). Critical because our LLM transport is Bedrock (IAM role, no API key).

**Architecture:**
- **Two mechanisms:**
  1. `output_config.format` with JSON schema: guarantees the response matches a declared schema via constrained decoding.
  2. `strict tool use`: validates tool parameters against schema.
- **Constrained decoding:** Grammar artifacts compiled from the schema; the model can only produce tokens that remain valid. Grammars cached server-side for 24 hours after first compilation.
- **Streaming support:** `InvokeModelWithResponseStream` + structured output → streams partial JSON conforming to schema. Compatible with incremental SpecStream patch accumulation.
- **Supported schema features:** basic types, enum, required, const, internal `$ref` via `$defs`, nullable, nested objects/arrays. NOT supported: recursive schemas, external `$ref`, numeric/string-length constraints, `if/then/else`.

**Implications for our design:**
- Our Spec JSON schema must stay within Bedrock's supported subset: no recursive schemas, no external refs. The flat element tree (by-ID references, not nested) is compatible.
- The 24-hour grammar cache means the first request per schema is slower (compilation); subsequent requests benefit from caching. This argues for keeping our Spec schema stable (not dynamically generated per request).
- `streamObject` equivalent via `InvokeModelWithResponseStream` + output schema → we get SpecStream patches natively.

**Sources:**
- https://aws.amazon.com/blogs/machine-learning/structured-outputs-on-amazon-bedrock-schema-compliant-ai-responses/
- https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html

---

## Reference 17: Academic / Research — Template Retrieval + Semantic Caching for UI

**Relevant work:**

**SpecifyUI (2025, UIST):** Multi-agent framework using a hierarchical `SPEC` (Page → Section → Component). RAG against 2,000 validated SPEC-code pairs. Edit triplets `(operation, path, value)` for scoped, structure-preserving modifications. 73% reduction in typing effort over text-based approaches. Key lesson: storing (SPEC, generated-output) pairs in a vector database and retrieving similar specs as few-shot examples dramatically improves generation quality for new requests.

**APD-Agents (2025):** Multi-agent architecture for automated page design. Semantic Parser → Template Retrieval (embeddings) → Layout Generation (LLM with retrieved few-shot examples). The retrieval step is key: embedding the design intent and fetching similar layouts as in-context examples significantly outperforms zero-shot generation. This is the "template flywheel" we want.

**Generative Caching for Structurally Similar Prompts (Microsoft Research, NeurIPS 2025):** GenCache clusters similar prompt-response pairs and generates a "program" that synthesizes correct responses from prompts as inputs. For UI specs: cache (request_embedding, spec_output) pairs; for a new request, retrieve the top-k nearest specs and return them as few-shot examples OR directly return the cached spec if similarity is high enough. Can reduce LLM inference cost by 86% and latency by 88%.

**Semantic Caching (Redis, AWS ElastiCache):** Standard pattern: embed each user request with Titan Text Embeddings → compare cosine similarity against cached embeddings → if similarity > threshold, return cached spec; else generate new spec → store (embedding, spec) in pgvector. Our stack (pgvector already in Supabase Postgres, Titan embeddings via Bedrock) is pre-built for this.

**What to steal:**
- The (request_embedding, generated_spec) storage pattern is the exact template library mechanism: every successful generation is a candidate template. Titan embeddings → pgvector already in our stack.
- The few-shot exemplar retrieval pattern: for a new UI request, retrieve the top-3 most similar historical specs and include them in the LLM prompt as examples. This constrains generation toward known-good patterns before structured output kicks in.
- SpecifyUI's edit triplet `(operation, path, value)` applied to the spec is the right interface for "accept/redraw" edit operations on generated specs — mutate the spec at a specific path rather than regenerating.

**Sources:**
- https://arxiv.org/html/2509.07334v1 (SpecifyUI)
- https://arxiv.org/pdf/2511.14101 (APD-Agents)
- https://www.microsoft.com/en-us/research/wp-content/uploads/2025/09/GenCache_NeurIPS25.pdf
- https://redis.io/blog/what-is-semantic-caching/

---

## Cross-Cutting Synthesis: What to Steal (Consolidated)

### Pattern 1: Catalog → Spec → Registry → Renderer (Four-Layer Architecture)
**Source:** json-render (definitive), A2UI, assistant-ui (confirms with allowlist)  
**Decision:** Adopt exactly. Catalog defined in `packages/ui` or `packages/genui-catalog` with Zod schemas + component descriptions. Spec is the LLM's output. Registry maps catalog names to `@nauta/ui` imports. Renderer is a pure React component with no eval.

### Pattern 2: Flat Element Tree + JSON Patch Streaming
**Source:** json-render (SpecStream), A2UI (JSONL), vs. DivKit/Adaptive Cards (nested, avoid)  
**Decision:** Flat element tree (`{ root, elements: { id: { type, props, children: [id…] } } }`). Stream as RFC 6902 JSON Patches via `InvokeModelWithResponseStream`. Each patch is independently applicable; no parent-before-child ordering constraint.

### Pattern 3: Zod Schema = LLM Constraint + Runtime Validator
**Source:** json-render, Tambo, RJSF  
**Decision:** One Zod schema per catalog component, serving dual purpose: Bedrock structured output constraint + runtime prop validation in the renderer. No separate type definitions.

### Pattern 4: Component Description Field for Semantic Selection
**Source:** Tambo  
**Decision:** Each catalog entry carries a `description: string` injected into the LLM system prompt. The LLM uses descriptions to choose which components to include in the spec. Descriptions should be opinionated about when/why to use each component.

### Pattern 5: Graceful Degradation for Unknown Types
**Source:** A2UI, Airbnb Ghost Platform, Adaptive Cards fallback, assistant-ui Fallback  
**Decision:** Unknown `type` in spec → render `<UnknownComponentPlaceholder name={type} />`. Never throw. Log for catalog gap analysis.

### Pattern 6: Template Library via (Embedding, Spec) Pairs in pgvector
**Source:** SpecifyUI RAG, APD-Agents retrieval, GenCache, semantic caching literature  
**Decision:** Every accepted generated spec is stored with its request embedding (Titan Embeddings via Bedrock). New requests retrieve top-k similar specs as few-shot examples. High-confidence matches can be returned directly (cache hit). This is our "promote to template library" flywheel. pgvector is already in Supabase.

### Pattern 7: Edit Triplets for Spec Mutation
**Source:** SpecifyUI edit triplets, DivKit element patches, Adaptive Cards Action.Execute  
**Decision:** User edits to generated UIs produce `{ op, path, value }` mutations (RFC 6902 JSON Patch compatible). Applied to the stored spec, not regenerated from scratch. Maintains spec integrity.

### Pattern 8: HostConfig / Catalog as Styling Adapter
**Source:** Adaptive Cards HostConfig, Airbnb section component configurability  
**Decision:** The catalog's registry layer (not the Spec) carries styling defaults. The Spec is styling-agnostic — it only specifies component types and props. `@nauta/ui` component defaults handle visual presentation.

### Pattern 9: Action Binding with Dual Output
**Source:** Thesys C1 `onAction`, AG-UI typed events  
**Decision:** Generated component actions emit `{ machineMessage: string, humanMessage: string }` to close the agent loop. The Renderer's action handler receives these and can feed them back to the LLM conversation thread.

### Pattern 10: Spec Schema Stability for Grammar Cache
**Source:** AWS Bedrock structured outputs 24hr grammar cache  
**Decision:** Keep the Spec JSON schema stable between requests (don't generate it dynamically). One schema per app version, compiled once, cached by Bedrock for 24 hours. Catalog changes = spec schema version bump.

---

## Ranked Shortlist: 5 References to Study Deepest

### #1 — Vercel `json-render` (vercel-labs/json-render)
**Why:** It is the closest implementation to what we want to build, open-source, battle-tested at Vercel scale, and architecturally aligned. The Catalog/Spec/Registry/Renderer pattern, SpecStream JSONL patches, Zod-first prop schemas, and shadcn/ui pre-built catalog are all directly applicable. Study the source code of `@json-render/core`, `@json-render/react`, and the AI SDK integration. The SpecStream format should be adopted as our wire format.  
**Study focus:** `createSpecStreamCompiler` internals, how the flat element tree is accumulated from patches, how the Renderer's four providers (State/Visibility/Action/Validation) interact, how the catalog Zod schema becomes a Bedrock tool definition.

### #2 — Airbnb Ghost Platform
**Why:** The canonical production SDUI at consumer scale. The `SectionComponentType` registry key pattern, the section/screen/action separation, and the "business logic centralized on server" philosophy are foundational concepts that have been proven over 4+ years. Study the tech blog in depth. The key insight — that server-driven UI enables live feature changes without client deploys — is the primary value proposition of our system.  
**Study focus:** How sections are made context-independent (self-contained data), the Screen/Section/Action three-type model, the single shared schema as truth, and the lessons around backward compatibility.

### #3 — Google A2UI Protocol
**Why:** The most architecturally rigorous treatment of "declarative UI spec as a protocol." The distinction between spec-as-tool vs. spec-as-protocol, the capability negotiation model (client advertises its catalog), and the security model (declarative format, not executable code) are concepts we must internalize. As the emerging standard, our spec design should be A2UI-compatible to remain interoperable.  
**Study focus:** The v0.9 spec format in detail, capability advertisement mechanism, how incremental updates work over A2A/AG-UI transports, the security rationale.

### #4 — SpecifyUI + APD-Agents (Academic)
**Why:** The most rigorous research on the template retrieval / flywheel side of the problem — the piece all production systems omit. SpecifyUI's RAG-against-SPEC-pairs pattern and APD-Agents' Template Retrieval Agent give us the architecture for semantic template caching using Titan Embeddings + pgvector. Edit triplets `(op, path, value)` give us the right mutation interface. This research directly addresses our "template library / promote good outputs" requirement.  
**Study focus:** SpecifyUI SPEC format hierarchy, the RAG dataset construction (how they collected 2,000 pairs), edit triplet application, APD-Agents' multi-agent orchestration for retrieval + generation.

### #5 — Tambo (tambo-ai/tambo)
**Why:** The best existing open-source production implementation of the agentic component-selection pattern with streaming props and two-mode components (generative vs. interactable). The registration API design (name + description + Zod schema) is the model for our catalog entry format. The `withTamboInteractable` pattern maps to our entity-canvas components that persist and update.  
**Study focus:** The full component registration type definitions, how `description` fields are injected into LLM prompts, the `withTamboInteractable` wrapper implementation, and the self-hosted backend architecture for extracting the agent orchestration pattern.

---

## Honorable Mentions

- **DivKit**: Study the `"templates"` block for named reusable sub-tree references (closest existing analog to our template library retrieval by name). Avoid the hierarchical spec format.
- **Plasmic code components**: Study the `hidden: (props) => boolean` conditional prop registration for informing LLM about valid prop combinations via system prompt.
- **assistant-ui**: Study `MessagePrimitive.GenerativeUI` for chat-context integration — relevant if our generated UIs appear within a conversation thread.
- **AWS Bedrock structured outputs**: Read the official schema subset docs carefully before designing our Spec JSON schema. No recursive schemas. No external refs. This constraint shapes our flat-element-tree decision.
- **AG-UI typed events**: `GENERATIVE_UI_START/CONTENT/END` event subset is worth adopting as our streaming transport event vocabulary for future multi-agent support.

---

*Research confidence: HIGH for json-render, Airbnb Ghost Platform, Tambo, assistant-ui, AWS Bedrock (primary sources read directly). MEDIUM for A2UI (based on blog posts + article, protocol spec not read in full). MEDIUM for SpecifyUI/APD-Agents (read via arxiv but PDF content partially extracted). LOW for DivKit expression language details and Plasmic JSON spec internals.*
