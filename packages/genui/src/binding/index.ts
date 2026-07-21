/**
 * binding/index.ts — Public surface for @polytoken/genui/binding (REG-04, the D2 proof).
 *
 * The capability-binding layer: how a genui spec REFERENCES a registry capability (the descriptor),
 * how that reference RESOLVES to a real, Zod-fenced invoker (bindCapability), how it FAILS CLOSED when
 * the id is unregistered (INV-5), and how the confirm gate is SURFACED (requiresConfirm, INV-4).
 */

export {
  CapabilityBindingSchema,
  CapabilityArgsSchema,
  type CapabilityBinding,
  type CapabilityArgs,
} from "./descriptor";

export { requiresConfirm } from "./risk-gate";

export {
  bindCapability,
  tryBindCapability,
  type BoundCapability,
  type BindResult,
  type CapabilityInvokeResult,
  type InvokeArgs,
} from "./bind-capability";

export {
  CapabilityBindingError,
  isCapabilityBindingError,
  type CapabilityBindingErrorCode,
} from "./errors";
