# LLM / Agent Generation Layer Research
## Spec-First Generative-UI Engine: Constrained UI Spec Generation on AWS Bedrock

**Researched:** 2026-06-26  
**Stack constraint:** AWS Bedrock via IAM role · Converse API · @ai-sdk/amazon-bedrock · Next.js App Router · tRPC · TypeScript · Zod  
**Overall confidence:** HIGH (source code read + official docs + AWS blog)

---

## 1. Structured / Constrained Output — How the Stack Actually Works

### 1.1 AI SDK v6 API (the current generation)

`generateObject` and `streamObject` are **deprecated** in AI SDK v6. The unified pattern is now `generateText` / `streamText` with an `output` parameter:

```typescript
import { generateText, streamText, Output } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

// Non-streaming
const { output } = await generateText({
  model: bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0'),
  output: Output.object({ schema: UISpecSchema }),
  system: SYSTEM_PROMPT,
  prompt: userRequest,
});

// Streaming (for perceived latency)
const result = streamText({
  model: bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0'),
  output: Output.object({ schema: UISpecSchema }),
  system: SYSTEM_PROMPT,
  prompt: userRequest,
});
// partialOutputStream: AsyncIterable<DeepPartial<T>>  (unvalidated partials)
// result.output: Promise<T>  (fully validated final object)
```

**Output modes available:**
- `Output.object({ schema })` — typed object, Zod/Valibot/JSON Schema, fully validated on completion
- `Output.array({ element: schema })` — array of typed items; `elementStream` emits validated complete items
- `Output.choice({ options: [...] })` — restricted string enum, good for classification
- `Output.json()` — unstructured JSON, no schema validation

**For streaming with `useObject` hook (client-side):**

```typescript
// Server route: src/app/api/generate-ui/route.ts
import { streamText, Output } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const result = streamText({
    model: bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0'),
    output: Output.object({ schema: UISpecSchema }),
    system: SYSTEM_PROMPT,
    prompt,
  });
  return result.toTextStreamResponse();
}

// Client component
import { experimental_useObject as useObject } from 'ai/react';

export function UIGenerator() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-ui',
    schema: UISpecSchema,  // Zod schema
  });
  // object is DeepPartial<UISpec> during streaming, full UISpec on completion
}
```

### 1.2 How the Bedrock Provider Handles Structured Output Internally

**Source-confirmed** (read from `packages/amazon-bedrock/src/amazon-bedrock-chat-language-model.ts`):

The provider checks two things to decide which structured output mechanism to use:

```
useNativeStructuredOutput =
  isAnthropicModel
  AND (modelSupportsStructuredOutput OR isThinkingEnabled)
  AND responseFormat.type === 'json'
  AND responseFormat.schema != null
```

**Path A — Native Bedrock Structured Output (Claude 4.5+ on Bedrock):**
Sets `additionalModelRequestFields.output_config.format`:
```json
{
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": { /* JSON Schema object */ }
    }
  }
}
```
This uses Bedrock's constrained decoding (grammar-based, token-level enforcement). Bedrock compiles the schema to a grammar artifact cached 24 hours per account.

**Path B — Tool-Calling Fallback (older models, or when native SO not available):**
Injects a synthetic tool named `"json"`:
```json
{
  "toolConfig": {
    "tools": [{
      "toolSpec": {
        "name": "json",
        "description": "Respond with a JSON object.",
        "inputSchema": { "json": { /* schema */ } }
      }
    }],
    "toolChoice": { "any": {} }  // forces the model to use it
  }
}
```
Then extracts `response.output.message.content[0].toolUse.input`.

**Critical finding:** `strict: true` on tool definitions is **explicitly disabled** for `claude-opus-4-7` and `claude-opus-4-8` in the source. The Bedrock provider also logs a warning that "Amazon Bedrock does not support strict mode on tool definitions."

### 1.3 Zod → JSON Schema Conversion

AI SDK uses `@ai-sdk/provider-utils`'s `asSchema()` which calls `zod-to-json-schema` internally. The resulting JSON Schema is passed directly to the Bedrock API (either as `output_config.format.schema` or as `toolSpec.inputSchema.json`).

**Bedrock JSON Schema constraints** (for native structured output path):
- SUPPORTED: object, array, string, integer, number, boolean, null; `enum`, `const`, `required`, `anyOf` (simple), `$ref`/`$defs` (internal only), string formats (date-time, email, UUID, URI)
- REQUIRED: `additionalProperties: false` on every object
- NOT SUPPORTED: recursive schemas, `minimum`/`maximum`, `minLength`/`maxLength`, `if`/`then`/`else`, complex `anyOf`/`oneOf` (causes grammar compilation timeout), external `$ref`

**For the UI spec schema, this means:**
- Use `z.discriminatedUnion` carefully — test for grammar compilation
- Keep schemas flat; avoid deep recursive component trees in the schema itself (flatten to a registry-keyed map)
- Always add `.strict()` on Zod objects (maps to `additionalProperties: false`)

### 1.4 Validation Failure Modes and Repair

**On completion:** AI SDK throws `AI_NoObjectGeneratedError` with fields: `text` (raw output), `response` (metadata), `usage` (tokens), `cause` (parse error or type validation error).

**Streaming:** Partial objects in `partialOutputStream` are `DeepPartial<T>` and explicitly not validated. Errors during streaming surface via `onError` callback, not exceptions.

**Repair hook:** `experimental_repairText` on `streamText`/`generateText` — receives `{ text, error }` and returns corrected text string or null. Use this for lightweight string fixes (e.g., remove trailing commas, close unclosed brackets) before re-parsing.

**Retry pattern:** `maxRetries` (default: 2) retries the entire generation on transient errors. For schema validation failures, you need to build a repair loop yourself:

```typescript
async function generateWithRepair(
  prompt: string,
  schema: z.ZodSchema<UISpec>,
  maxAttempts = 3,
): Promise<UISpec> {
  let lastError: unknown;
  let lastRawText: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { output } = await generateText({
        model: bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0'),
        output: Output.object({ schema }),
        system: attempt === 0
          ? SYSTEM_PROMPT
          : buildRepairSystemPrompt(lastRawText, lastError),
        prompt: attempt === 0 ? prompt : REPAIR_PROMPT,
        temperature: 0,  // deterministic for structured output
      });
      return output;
    } catch (err) {
      lastError = err;
      if (err instanceof Error && 'text' in err) {
        lastRawText = (err as any).text;
      }
    }
  }
  throw new Error(`UI spec generation failed after ${maxAttempts} attempts`);
}
```

---

## 2. Bedrock Specifics

### 2.1 Converse API vs InvokeModel

Use Converse/ConverseStream (not InvokeModel). It is the unified API across all Bedrock models, handles multi-turn, supports both tool use and the `outputConfig.textFormat` structured output parameter. The `@ai-sdk/amazon-bedrock` provider uses Converse exclusively.

**Structured outputs on Bedrock: launched February 4, 2026.** Generally available for Claude 4.5 models (Haiku 4.5, Sonnet 4.5, Opus 4.5) and select open-weight models, across all commercial AWS Regions.

### 2.2 Model Selection: Haiku 4.5 vs Sonnet 4.5

For runtime UI spec generation (latency-sensitive, called per user request):

| Attribute | Claude Haiku 4.5 | Claude Sonnet 4.5 |
|-----------|-----------------|-------------------|
| Input cost | $1/M tokens | ~$3/M tokens |
| Output cost | $5/M tokens | ~$15/M tokens |
| Cost advantage | 3× cheaper | baseline |
| TTFT | ~0.36s | ~0.64s |
| Token throughput | ~53 tok/s | ~51 tok/s |
| Context window | 200K tokens | 200K tokens |
| Structured output | YES (Claude 4.5+) | YES (Claude 4.5+) |
| Tool use | YES | YES |
| SWE-bench | 73.3% | higher |

**Recommendation: Use Haiku 4.5 for runtime generation.** A UI spec is a well-defined, constrained task — not a reasoning-heavy benchmark. Haiku 4.5's reasoning is sufficient when the schema is tight, few-shot examples are injected, and the output is constrained by the grammar. Reserve Sonnet for fallback on complex specs or multi-step planning calls.

**Token/latency budget estimate for a UI spec:**
- System prompt + registry description + few-shot examples: ~2,000–4,000 input tokens
- Generated UI spec JSON: ~500–2,000 output tokens (depends on spec size)
- At Haiku 4.5 throughput (~53 tok/s): 500–2,000 output tokens = ~10–38s wall time
- With streaming, first tokens appear in <1s — **streaming is non-negotiable for runtime UX**

**Prompt caching on Bedrock (Haiku 4.5):**
- Cache write: $1.25/M tokens; cache read: $0.10/M tokens (12.5× cheaper than write)
- Cache the system prompt + registry description (static across requests)
- Per-request cost drops to only the user prompt + output tokens after first request

### 2.3 Streaming Partial JSON on Bedrock

The Bedrock `ConverseStream` API streams JSON tokens as `contentBlockDelta` events. When using the AI SDK `@ai-sdk/amazon-bedrock` provider with `streamText + Output.object`, this surfaces as `partialOutputStream` yielding `DeepPartial<UISpec>` chunks. The renderer should handle undefined-safe access on partials.

**Fine-grained tool streaming beta:** For Claude 4.5+, Anthropic offers a beta that distributes tool argument chunks more evenly (rather than one large final chunk). This is beneficial for tool-based structured output but is in beta. The AI SDK Bedrock provider handles this via the `anthropic_beta` additional model request field.

---

## 3. Reliability Patterns

### 3.1 Schema Design for Reliability

The most impactful reliability lever is schema design, not retry count.

```typescript
// BAD: Unbounded, recursive, additionalProperties not false
const ComponentNode = z.lazy(() => z.object({
  type: z.string(),
  props: z.record(z.unknown()),
  children: z.array(ComponentNode).optional(),
}));

// GOOD: Flat map keyed by ID, bounded depth, strict
const ComponentNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['DataTable', 'KpiCard', 'FilterBar', 'ActionButton', 'TextDisplay', 'FormField']),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  children: z.array(z.string()).optional(),  // IDs only, not recursive nodes
  stateBindings: z.array(StateBindingSchema).optional(),
  dataBinding: DataBindingSchema.optional(),
  actions: z.array(ActionSchema).optional(),
}).strict();

const UISpecSchema = z.object({
  rootId: z.string().describe('ID of the root component'),
  components: z.record(z.string(), ComponentNodeSchema).describe('Flat map of all components by ID'),
  stateSlots: z.array(StateSlotSchema).describe('Declared mutable state slots'),
  title: z.string().describe('Human-readable name for this view'),
}).strict();
```

**Key rules:**
1. **No recursive Zod schemas** — Bedrock's grammar compiler cannot handle them. Use a flat `components` map with ID references for children.
2. **Strict on every object** (`z.object({}).strict()`) → emits `additionalProperties: false` → required for Bedrock native SO.
3. **Put reasoning field first in schema** — Claude generates fields in declaration order. A `reasoning` or `_plan` field placed first lets the model think before committing to component choices.
4. **Use `.describe()` on every field** — these become inline instructions in the Bedrock constrained output prompt.
5. **Bounded enums over free strings** — `type: z.enum([...])` strictly restricts to the registry allowlist.

### 3.2 Single-Shot vs Multi-Step Generation

**Single-shot (recommended for MVP and runtime latency):**
One call, model receives the full context (user intent + registry + state schema + few-shot) and emits a complete spec.
- Latency: one RTT
- Reliability: higher with good schema + few-shot + constrained decoding
- Failure mode: hallucinates a component type or tRPC binding name

**Multi-step (better reliability, higher latency and cost):**
Step 1 (planning): `Output.text()` — model writes a plan in natural language describing which components and data to show. Low token cost, no structure constraints.
Step 2 (generation): `Output.object({ schema })` — model fills the spec given its own plan. Dramatically more reliable because reasoning already happened unconstrained.

Research confirms this: "separating reasoning and structuring into two distinct stages avoids simultaneous constraint conflicts that impair model performance." The planning step with `Output.text()` or a scratchpad approach (`_plan` field first in schema) addresses this.

**Recommended approach:** Use a `_plan` field as the FIRST field in the schema — Claude will fill it as a reasoning trace, which anchors the subsequent component choices. The field can be stripped before rendering.

```typescript
const UISpecSchema = z.object({
  _plan: z.string().describe('Brief reasoning: what the user needs, which components to use, which tRPC procedures to bind, and what state slots are needed.'),
  rootId: z.string(),
  components: z.record(z.string(), ComponentNodeSchema),
  stateSlots: z.array(StateSlotSchema),
  title: z.string(),
}).strict();
```

### 3.3 Registry Allowlist Enforcement

Two layers:
1. **Schema-level (Zod/JSON Schema enum):** `type: z.enum(['DataTable', 'KpiCard', ...])` — Bedrock's constrained decoding makes it physically impossible to emit an unregistered component name.
2. **Runtime validation layer:** After parsing, validate each `stateBindings.procedureName` against the allowlisted tRPC procedure names before rendering. Schema enum for procedures names: `z.enum(['emailRouter.list', 'emailRouter.getById', ...])`.

### 3.4 Few-Shot Template Retrieval

Inject 2–3 retrieved example specs into the system prompt. Retrieval source: a curated set of validated specs stored with Titan embeddings in the existing Supabase vector store. Retrieve by cosine similarity to the user's request.

Evidence: RAG + few-shot combined achieves 95% task completion vs 70% for few-shot alone (ChatVis benchmark).

```
SYSTEM:
You are a UI spec generator. Output ONLY valid JSON matching the schema.

## Component Registry
<registry description with prop signatures>

## tRPC Procedures Available
<list of allowlisted procedure names with descriptions>

## Examples
<retrieved spec 1>
<retrieved spec 2>

## Schema
<JSON Schema>
```

---

## 4. Declared-Primitive Design for State / Data / Actions

### 4.1 State Slots

Declare state as named, typed slots the renderer manages. The model declares them; it does not write code to manage them.

```typescript
const StateSlotSchema = z.object({
  id: z.string().describe('Unique state slot ID (used in bindings)'),
  type: z.enum(['string', 'number', 'boolean', 'string[]', 'object']),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  label: z.string().describe('Human readable name for debugging'),
}).strict();
```

Example: `{ id: "selectedEmailId", type: "string", defaultValue: null, label: "Selected Email" }`

### 4.2 Data Bindings (tRPC Procedure References)

The model declares which tRPC procedure to call and what arguments to pass (which can be state-slot references). The renderer executes the actual call.

```typescript
const DataBindingSchema = z.object({
  procedureName: z.enum([...ALLOWLISTED_TRPC_PROCEDURES]),
  args: z.record(z.string(), z.union([
    z.object({ $state: z.string() }).describe('Reference to a state slot by ID'),
    z.string(),
    z.number(),
    z.boolean(),
  ])).optional(),
  onLoadingSlot: z.string().optional().describe('State slot ID to set true while loading'),
}).strict();
```

Example: `{ procedureName: "emailRouter.list", args: { folderId: { $state: "activeFolderId" } } }`

The renderer resolves `{ $state: "activeFolderId" }` to the current state value and passes it to `trpc.emailRouter.list.useQuery(resolvedArgs)`.

### 4.3 Actions / Events

Actions are declare-only event handlers. The model picks from an allowlist of action types and provides parameters.

```typescript
const ActionSchema = z.object({
  trigger: z.enum(['onClick', 'onChange', 'onSubmit', 'onMount', 'onRowSelect']),
  type: z.enum(['navigate', 'setState', 'mutate', 'toast']),
  payload: z.union([
    // navigate
    z.object({ type: z.literal('navigate'), href: z.string() }).strict(),
    // setState
    z.object({ type: z.literal('setState'), slotId: z.string(), value: z.union([z.string(), z.number(), z.boolean(), z.object({ $event: z.string() })]) }).strict(),
    // mutate (calls a tRPC mutation)
    z.object({ type: z.literal('mutate'), procedureName: z.enum([...ALLOWLISTED_TRPC_MUTATIONS]), args: z.record(z.string(), z.unknown()) }).strict(),
    // toast
    z.object({ type: z.literal('toast'), message: z.string(), variant: z.enum(['success', 'error', 'info']) }).strict(),
  ]),
}).strict();
```

The renderer maps `{ trigger: 'onClick', type: 'navigate', payload: { href: '/emails/{$state.selectedEmailId}' } }` to an actual click handler without the model writing JavaScript.

### 4.4 Art of the Spec: What the Model Declares vs What the Runtime Does

| Concern | Model Declares | Runtime Resolves |
|---------|---------------|-----------------|
| Layout | Component tree with IDs and types | React rendering of registry components |
| Data | `{ procedureName, args }` binding | `trpc[procedure].useQuery(resolvedArgs)` |
| State | `{ id, type, defaultValue }` slots | React `useState` or Zustand atoms |
| Interactivity | `{ trigger, type, payload }` actions | Event handler closures |
| Navigation | `{ type: 'navigate', href }` | `router.push(resolvedHref)` |
| Mutations | `{ type: 'mutate', procedureName, args }` | `trpc[procedure].useMutation().mutate()` |

**This is why spec beats raw code:** The model never touches `useState`, `useEffect`, `router`, or `trpc`. It only declares what should exist and what should happen. The runtime has authority over how. This makes validation trivially complete (JSON Schema check) vs raw code (require execution sandbox + type checking).

---

## 5. Spec vs Raw Code: The Generation Standpoint

### Why Spec Wins for Reliability

| Criterion | Declared Spec (JSON) | Raw Code (TSX/JSX) |
|-----------|---------------------|-------------------|
| Validation | Schema check (ms) | Type check + exec sandbox |
| Constrained decoding | YES (Bedrock grammar) | Impractical for code |
| Repair | Re-generate spec | Re-generate entire component |
| Registry enforcement | Enum at generation time | Post-gen lint rule |
| Security | Props sandboxed per component | `dangerouslySetInnerHTML` risk |
| Streaming | Partial JSON safe to parse | Partial code cannot execute |
| Token budget | 500–2K tokens per spec | 2K–10K+ for styled component |
| Error blast radius | Bad spec = graceful fallback | Bad code = runtime crash |

**Raw code wins only for:** maximum design freedom (arbitrary styling, custom logic). Not relevant here — the design system is fixed.

The arXiv generative UI paper (2604.09577) showed raw HTML is preferred 82.8% of the time in open-ended tasks — but that research used no component registry and targeted marketing pages. For application UI with data bindings, a constrained spec is the only viable runtime approach.

---

## 6. Complete Generation Call + Repair Loop

### 6.1 The Generation Function (TypeScript)

```typescript
import { generateText, streamText, Output } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { z } from 'zod';

// IAM role via ECS task role / instance profile
const bedrock = createAmazonBedrock({
  credentialProvider: fromNodeProviderChain(),
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const HAIKU_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

// Build system prompt with registry, procedures, and few-shot examples
function buildSystemPrompt(retrievedExamples: UISpec[]): string {
  return `You are a UI spec generator for the Nauta email intelligence platform.

## Component Registry
${COMPONENT_REGISTRY_DESCRIPTION}

## Available tRPC Query Procedures
${QUERY_PROCEDURES.map(p => `- ${p.name}: ${p.description}`).join('\n')}

## Available tRPC Mutation Procedures  
${MUTATION_PROCEDURES.map(p => `- ${p.name}: ${p.description}`).join('\n')}

## Output Format
Output ONLY valid JSON. No markdown fences. No explanation.
Use only component types and procedure names listed above.

## Examples
${retrievedExamples.map(ex => JSON.stringify(ex, null, 2)).join('\n\n---\n\n')}`;
}

// Streaming version for runtime use (SSE to client)
export async function streamUISpec(
  userRequest: string,
  retrievedExamples: UISpec[],
): Promise<ReadableStream> {
  const result = streamText({
    model: bedrock(HAIKU_MODEL),
    output: Output.object({ schema: UISpecSchema }),
    system: buildSystemPrompt(retrievedExamples),
    prompt: userRequest,
    temperature: 0,
    providerOptions: {
      amazonBedrock: {
        // Cache the system prompt (static content)
        cachePoint: { type: 'default' },
      },
    },
    experimental_repairText: async ({ text, error }) => {
      // Lightweight structural repairs before re-validation
      let repaired = text.trim();
      // Remove markdown fences if model wraps JSON
      repaired = repaired.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      // Attempt to close incomplete JSON (truncated by maxTokens)
      if (!repaired.endsWith('}')) {
        repaired += '"}}}';  // best-effort close
      }
      return repaired;
    },
  });
  return result.toTextStreamResponse().body!;
}

// Non-streaming with repair loop for server-side generation
export async function generateUISpec(
  userRequest: string,
  retrievedExamples: UISpec[],
  maxAttempts = 3,
): Promise<UISpec> {
  let lastError: unknown;
  let lastRawText: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const systemPrompt = attempt === 0
      ? buildSystemPrompt(retrievedExamples)
      : buildRepairSystemPrompt(retrievedExamples, lastRawText, lastError);

    try {
      const { output } = await generateText({
        model: bedrock(HAIKU_MODEL),
        output: Output.object({ schema: UISpecSchema }),
        system: systemPrompt,
        prompt: attempt === 0 ? userRequest : 'Fix the JSON above to match the schema exactly.',
        temperature: 0,
        maxRetries: 1,  // AI SDK-level retry for network errors
      });
      return output;
    } catch (err) {
      lastError = err;
      lastRawText = (err as any).text ?? undefined;
      // eslint-disable-next-line no-console
      console.error(`[ui-gen] attempt ${attempt + 1} failed:`, err);
    }
  }

  throw new Error(`UI spec generation failed after ${maxAttempts} attempts`);
}

function buildRepairSystemPrompt(
  examples: UISpec[],
  lastText: string | undefined,
  err: unknown,
): string {
  return `${buildSystemPrompt(examples)}

## Previous Output (INVALID)
${lastText ?? '(none)'}

## Validation Error
${err instanceof Error ? err.message : JSON.stringify(err)}

Fix the JSON to pass schema validation. Output ONLY valid JSON.`;
}
```

### 6.2 Next.js App Router Route (tRPC via server action or API route)

```typescript
// src/app/api/ui/generate/route.ts
import { streamUISpec } from '@/lib/ui-generation/generate';
import { retrieveSimilarSpecs } from '@/lib/ui-generation/retrieval';
import { z } from 'zod';

const RequestSchema = z.object({
  request: z.string().min(1).max(2000),
  contextId: z.string().uuid().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const body = RequestSchema.parse(await req.json());
  const examples = await retrieveSimilarSpecs(body.request, 3);
  const stream = await streamUISpec(body.request, examples);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 6.3 Client-Side useObject Pattern

```typescript
// src/components/ui/UIRenderer.tsx
'use client';
import { experimental_useObject as useObject } from 'ai/react';
import { UISpecSchema } from '@/lib/ui-generation/schema';
import { renderSpec } from '@/lib/ui-generation/renderer';

export function UIGenerator({ contextId }: { contextId?: string }) {
  const { object, submit, isLoading, error } = useObject({
    api: '/api/ui/generate',
    schema: UISpecSchema,
  });

  // object is DeepPartial<UISpec> during streaming
  // Render partial spec progressively; undefined-guard on every access
  const rendered = object ? renderSpec(object, { partial: isLoading }) : null;

  return (
    <div>
      {isLoading && <SpecSkeleton partialSpec={object} />}
      {rendered}
      {error && <GenerationError error={error} />}
    </div>
  );
}
```

---

## 7. Key Warnings and Pitfalls

### 7.1 Zod v3 vs v4 Incompatibility
AI SDK currently requires **Zod v3**. Using Zod v4 causes schema validation errors at runtime. Pin `"zod": "^3.23.0"` in the UI generation package until the AI SDK migrates.

### 7.2 strict Mode on Bedrock Tool Definitions
Bedrock explicitly does NOT support `strict: true` on Bedrock tool definitions (logged as a warning in AI SDK Bedrock provider source). This only affects the tool-calling fallback path. Native structured output (Claude 4.5+ with `output_config.format`) has its own enforcement via constrained decoding and does not use `strict`.

### 7.3 Schema Compilation Latency on First Request
Bedrock compiles JSON Schemas to grammar artifacts. First request with a new schema has added latency. Grammars are cached 24 hours per account. **Do not generate variant schemas per-request.** Use a single, stable `UISpecSchema` definition cached at module load time.

### 7.4 `additionalProperties: false` Is Mandatory
Without it, Bedrock's structured output API returns a 400. Zod's `.strict()` adds this. Verify every nested Zod object also has `.strict()` — it is not inherited.

### 7.5 Recursive Zod Schemas Break Grammar Compilation
`z.lazy(() => ComponentNode)` in the schema will cause a grammar compilation timeout or error. Use a flat `components: z.record(id, NodeSchema)` map instead.

### 7.6 Mode Parameter Is Gone in v5/v6
The old `mode: "tool" | "json"` parameter on `generateObject`/`streamObject` is no longer exposed in AI SDK v5+. The provider selects mode automatically based on `modelSupportsStructuredOutput`. On Bedrock with Claude 4.5+, it chooses native SO. On older models, it falls back to the synthetic `json` tool. Do not try to pass `mode`.

### 7.7 stopWhen Step Count When Combining Tools + Structured Output
If the generation pipeline includes tool calls (e.g., a planning tool) before emitting the final spec, the structured output generation counts as an additional step. Increment `stopWhen: isStepCount(n+1)` to account for this.

### 7.8 Partial Streaming Props Are Unconstrained
`partialOutputStream` yields `DeepPartial<UISpec>` — every field is potentially `undefined`. The renderer must defensively access every field. A `renderPartialSafe(partial)` wrapper that gracefully handles missing fields is essential.

### 7.9 Content Policy Can Override Schema Constraints
Bedrock's safety guardrails can cause the model to refuse or truncate output. Check `stopReason` in the response; if it's `"guardrail_intervened"` or `"max_tokens"`, handle separately from schema validation failures.

---

## 8. Alternatives Considered and Rejected

### Raw HTML / TSX Generation
Google's generative UI paper achieved 82.8% user preference with raw HTML. Rejected because: no registry enforcement, no data binding safety, requires execution sandbox for validation, token cost 5–10× higher, streaming useless (partial code cannot render), security risks with HTML injection.

### LangChain / LangGraph for Generation
Rejected in favor of AI SDK because: host project already uses `@ai-sdk/amazon-bedrock` for email intelligence (Phase 4), AI SDK has direct Bedrock Converse API integration with IAM role credential chain, adding a second framework adds dependency complexity.

### OpenAI-Compatible Proxy in Front of Bedrock
Some projects run an OpenAI-compatible proxy to use Bedrock. Rejected because: existing IAM role setup works directly, the proxy adds latency, and AI SDK Bedrock provider is mature.

### Vercel AI SDK RSC (`streamUI`, `createStreamableUI`)
The RSC primitives are designed for chat-style generation, not for spec-first generative UI. They do not produce a serializable spec — they stream React elements directly. Rejected because: specs must be persistable and shareable, and RSC streaming requires Vercel infrastructure.

---

## Sources

- AI SDK v6 Output API: https://ai-sdk.dev/docs/reference/ai-sdk-core/output
- AI SDK Migration v5→v6: https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0
- AI SDK Generating Structured Data: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- AI SDK Amazon Bedrock Provider: https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock
- Bedrock Structured Outputs Launch (Feb 2026): https://aws.amazon.com/about-aws/whats-new/2026/02/structured-outputs-available-amazon-bedrock/
- Bedrock Structured Outputs Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-structured-outputs.html
- Bedrock Structured Outputs (Classmethod technical deep dive): https://dev.classmethod.jp/en/articles/amazon-bedrock-structured-outputs-json/
- fourtheorem Bedrock SO analysis: https://fourtheorem.com/amazon-bedrock-structured-outputs/
- AWS Blog — Structured Outputs schema-compliant: https://aws.amazon.com/blogs/machine-learning/structured-outputs-on-amazon-bedrock-schema-compliant-ai-responses/
- AI SDK Bedrock source — structured output decision logic: https://github.com/vercel/ai (packages/amazon-bedrock/src/amazon-bedrock-chat-language-model.ts, read directly via gh API)
- AI SDK streamObject mode regression (wontfix): https://github.com/vercel/ai/issues/7791
- vercel-labs/json-render — component registry + state spec: https://github.com/vercel-labs/json-render
- assistant-ui generative UI spec: https://www.assistant-ui.com/docs/tools/generative-ui
- Instill AI — two-stage generation (reasoning + structuring): https://www.instill-ai.com/blog/llm-structured-outputs
- Generative UI paper (spec vs raw HTML benchmark): https://arxiv.org/abs/2604.09577
- Claude Haiku 4.5 pricing/specs: https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity
- Claude model comparison: https://docsbot.ai/models/compare/claude-3-7-sonnet/claude-3-5-haiku
- RAG + few-shot 95% completion rate: https://arxiv.org/pdf/2507.23096 (ChatVis paper)
