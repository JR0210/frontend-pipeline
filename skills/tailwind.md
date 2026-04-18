---
name: tailwind
description: Enforce Tailwind CSS conventions on v0-generated code. Use this skill when the pipeline is transforming or validating v0 output that uses Tailwind — ensuring utility-class composition, responsive prefixes, dark mode support, and conditional class patterns meet project standards.
---

This skill guides the Tailwind audit pass on v0-generated components. v0 often outputs inconsistent utility class usage, inline styles, or arbitrary CSS — apply these rules during transformation to align output with Tailwind best practices.

# Tailwind CSS

> Use Tailwind utility classes for styling; avoid inline styles and custom CSS.

Tailwind rules:
- Compose utility classes; avoid creating custom CSS unless absolutely necessary
- Use responsive prefixes (`sm:`, `md:`, `lg:`) for responsive design
- Use dark mode variant (`dark:`) for dark theme support
- Use `cn()` (clsx/tailwind-merge) for conditional class composition

```pattern
className=|tailwind|clsx|cn\(
```

```tsx
import { cn } from "@/lib/utils";

// ✅ Responsive + conditional classes
<div
  className={cn(
    "rounded-lg border p-4 shadow-sm",
    "sm:p-6 md:p-8",
    isActive && "border-blue-500 bg-blue-50",
    isError && "border-red-500 bg-red-50"
  )}
>
  {children}
</div>
```
