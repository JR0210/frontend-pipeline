---
name: error-boundaries
description: Enforce production-grade error handling and recoverable UI states in v0-generated Next.js/React code. Use this skill when the pipeline is generating wrapper components, Suspense boundaries, or any async data-fetching component — ensuring errors surface gracefully rather than crashing the page.
---

This skill guides the error boundary and loading state pass on v0-generated components. v0 does not generate error recovery UI, rarely produces meaningful loading states, and omits `error.tsx` / `loading.tsx` boundaries entirely — apply these rules to make output resilient.

# Error Boundaries & Loading States

> Expected errors are return values. Unexpected errors need boundaries. Every async surface needs both.

## Error Classification

Treat errors in two categories — they need different handling:

- **Expected errors** (validation failures, 404s, network timeouts): Return as values using `useActionState`, server action return types, or explicit union types. Do not `throw` these.
- **Unexpected errors** (crashes, unhandled exceptions, third-party failures): Catch with React error boundaries. In Next.js App Router, this means `error.tsx` and `global-error.tsx`.

## Next.js App Router Boundaries

The App Router uses file-based error isolation. Add these alongside any route segment that fetches data or can fail:

- `error.tsx` — catches unexpected errors within a route segment, renders a recovery UI with a reset button.
- `loading.tsx` — renders a Suspense fallback while the segment streams in.
- `global-error.tsx` — catches errors in the root layout; must include `<html>` and `<body>` since it replaces the root layout entirely.

## Loading States: Skeletons over Spinners

Skeleton screens preserve layout and prevent CLS; spinners cause layout shift and feel slower.

- Match skeleton dimensions to the real content they replace — use the same grid, the same approximate heights.
- Use `animate-pulse` (Tailwind) or a CSS animation on skeleton blocks.
- For lists, render 3–5 skeleton items at a fixed height rather than a single centered spinner.
- Reserve spinners only for inline, button-level feedback (form submission, action loading).

## Recovery UI Requirements

An error boundary is not useful without a recovery path. Every `error.tsx` must:

1. Display a human-readable message — not a raw error string or stack trace.
2. Provide an action: a "Try again" button that calls `reset()`, or a link back to a safe route.
3. Log the error to an observability sink (the pipeline's `errorTracker`).
4. Not expose internal error details to the user in production.

## Suspense Wrapping

- Wrap every async server component call that is not critical to initial paint in `<Suspense>`.
- Pass a meaningful `fallback` — a sized skeleton, not `null` or a generic spinner.
- Avoid deeply nested Suspense boundaries; batch related async fetches at a common boundary.

```pattern
Suspense|ErrorBoundary|error\.tsx|loading\.tsx|useActionState|reset\(\)|fallback=
```

```tsx
// ✅ error.tsx — route-level error boundary
"use client";

import { useEffect } from "react";
import { errorTracker } from "@/observability/errorTracker";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    errorTracker.captureException("ROUTE_ERROR", error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16">
      <p className="text-muted-foreground">Something went wrong.</p>
      <button onClick={reset} className="btn-primary">Try again</button>
    </div>
  );
}

// ✅ loading.tsx — skeleton matching real content layout
export default function Loading() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
      ))}
    </ul>
  );
}

// ✅ Suspense with meaningful fallback (inline)
<Suspense fallback={<ProductCardSkeleton />}>
  <ProductCard id={id} />
</Suspense>

// ✅ Expected errors returned as values (Server Action)
async function submitForm(data: FormData): Promise<{ error?: string }> {
  const result = schema.safeParse(Object.fromEntries(data));
  if (!result.success) {
    return { error: result.error.issues[0].message };  // returned, not thrown
  }
  await saveToDatabase(result.data);
  return {};
}
```
