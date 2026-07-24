/**
 * renderer/safe-invoke-action.ts — fail-soft invocation of host action handlers.
 *
 * The ActionRegistry (SEAM-02) is the host-injection seam: canvas panels, capability
 * cards, and other surfaces register their OWN handlers into the context. Those handlers
 * routinely do real work (capability calls, mutations, navigation) and are frequently
 * async — so they can throw synchronously OR return a rejected promise.
 *
 * The catalog invokes those handlers from inside DOM event callbacks (button onClick,
 * form onSubmit). React error boundaries do NOT catch errors thrown in event handlers,
 * and a rejected promise returned from an event handler becomes an *unhandled rejection*
 * (a crash overlay in Next dev, an uncaught error in prod). A malformed or failing action
 * is a NORMAL outcome for model-generated UI — it must never crash the surrounding surface.
 *
 * safeInvokeAction is the single choke point that makes an action handler fail-soft:
 *   - a synchronous throw is caught,
 *   - a rejected promise return value is caught (its rejection is consumed),
 *   - the failure is logged server-side with a stable, greppable prefix so it is
 *     debuggable — never silently swallowed (CLAUDE.md: "Log detailed errors
 *     server-side; show friendly messages client-side"),
 *   - the caller (the button/form) proceeds unaffected.
 *
 * Security: no eval, no Function, no dangerouslySetInnerHTML (GR-01). Pure control flow.
 */

/** Narrow an unknown value to a thenable (a returned promise) without assuming Promise identity. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Log a handler failure with a stable, greppable prefix. Server-side only — no user-facing throw. */
function logActionFailure(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[genui/action] ${context} handler failed: ${message}`, error);
}

/**
 * Invoke an action handler thunk so that neither a synchronous throw nor an async
 * rejection can escape into the surrounding React surface.
 *
 * @param invoke  — a zero-arg thunk that calls the resolved handler (closes over its args)
 * @param context — a short label for logs, e.g. `button:navigate` or `form:setState`
 */
export function safeInvokeAction(invoke: () => unknown, context: string): void {
  let result: unknown;
  try {
    result = invoke();
  } catch (error) {
    logActionFailure(context, error);
    return;
  }

  if (isThenable(result)) {
    // Consume the rejection so it never becomes an unhandled promise rejection.
    // .then(undefined, onRejected) is used rather than .catch so a non-Promise
    // thenable (PromiseLike) is handled too.
    result.then(undefined, (error: unknown) => {
      logActionFailure(context, error);
    });
  }
}
