---
name: typescript
description: Enforce strict TypeScript conventions on v0-generated code. Use this skill when the pipeline is auditing or transforming v0 output — ensuring proper type coverage, no implicit any, typed prop interfaces, and idiomatic TypeScript patterns throughout.
---

This skill guides the TypeScript audit pass on v0-generated components. v0 frequently produces `any` types, missing prop interfaces, loose return types, and untyped event handlers — apply these rules during transformation to produce type-safe, production-grade output.

# TypeScript

> All generated code must be fully typed — no `any`, no implicit types, no missing prop interfaces.

## Type Conventions

- **Interfaces over types**: Use `interface` for component props and object shapes; use `type` for unions, intersections, and aliases.
- **No enums**: Use `const` maps instead — enums produce runtime code and are harder to tree-shake.
- **No `any`**: Replace with `unknown` for truly unknown values, or proper generics. `any` in v0 output is always a smell.
- **Auxiliary verb naming**: Boolean props and state should read as questions — `isLoading`, `hasError`, `isVisible`, `canSubmit`.
- **Strict mode**: `tsconfig.json` must have `"strict": true`. Do not weaken it.

## Component Prop Interfaces

Every component must have an explicit props interface. v0 commonly omits these or uses inline object types.

- Place the props interface immediately above the component function.
- Use `interface`, not `type`, for props.
- Export the interface if the component is exported — consumers may need to extend or pass props programmatically.
- Provide default values at the destructuring site, not in the interface.

## Return Types

- Async server components and data-fetching functions must have explicit return types.
- Custom hooks must declare their return type — either as a named interface or inline tuple.
- Event handlers should be typed as `React.MouseEventHandler<HTMLButtonElement>` etc., not `(e: any) => void`.

## What to Fix in v0 Output

- `any` in props, state, or event handlers → replace with proper types
- Untyped `useState` → add the generic: `useState<string>("")`
- Missing prop interfaces → extract and name them
- `enum` declarations → convert to `const` maps
- Implicit `any` from untyped third-party imports → add or install `@types/*`

```pattern
: any|useState\(|interface|Props|type |as unknown
```

```tsx
// ❌ v0 output — untyped props and any
export function Card({ title, onClick }: any) {
  const [data, setData] = useState(null);
  ...
}

// ✅ Transformed — explicit interface, typed state
interface CardProps {
  title: string;
  description?: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}

export function Card({ title, description, onClick }: CardProps) {
  const [data, setData] = useState<string | null>(null);
  ...
}

// ✅ const map instead of enum
const Status = {
  Idle: "idle",
  Loading: "loading",
  Error: "error",
} as const;
type Status = (typeof Status)[keyof typeof Status];

// ✅ Typed custom hook return
interface UseProductState {
  data: Product | null;
  isLoading: boolean;
  error: Error | null;
}

export function useProduct(id: string): UseProductState {
  ...
}
```
