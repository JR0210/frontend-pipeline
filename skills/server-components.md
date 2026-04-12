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
