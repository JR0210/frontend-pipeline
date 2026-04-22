---
name: server-components
description: Enforce correct React Server Component boundaries in v0-generated Next.js code. Use this skill when the pipeline is transforming v0 output targeting Next.js App Router — ensuring "use client" directives are placed only at justified leaf boundaries and server components are used by default.
---

This skill guides the pipeline's server/client boundary audit on v0-generated Next.js components. v0 often adds "use client" indiscriminately or fetches data client-side when server components would be more appropriate — apply these rules to produce output optimized for the App Router.

# Server Components

> Prefer React Server Components by default; only add "use client" when necessary.

Server Components run exclusively on the server, reducing the JavaScript bundle sent
to the browser and improving performance. Use them for:
- Data fetching
- Rendering static or infrequently-changing content
- Layouts and shells

Use `"use client"` only at the leaf component boundary when you need:
- `useState`, `useEffect`, `useReducer`, `useRef`, `useCallback`, `useMemo`
- Browser event handlers (`onClick`, `onChange`, etc.)
- Browser-only APIs (`window`, `document`, `localStorage`)

```pattern
useState|useEffect|useRef|onClick|onChange|window\.|localStorage
```

```tsx
// ✅ Server Component (default)
export default async function ProductList() {
  const products = await fetchProducts();
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}

// ✅ Client Component (justified)
"use client";
import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```
