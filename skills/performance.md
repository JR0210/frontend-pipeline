---
name: performance
description: Enforce Core Web Vitals and runtime performance standards on v0-generated Next.js/React code. Use this skill when the pipeline is transforming v0 output into production components — ensuring images, fonts, loading strategies, and bundle size meet production performance expectations.
---

This skill guides the performance audit pass on v0-generated components. v0 routinely produces layout-blocking fonts, unoptimized images, unnecessary client components, and missing lazy-loading — apply these rules to ensure output is viable in production.

# Performance

> Production output must prioritize Core Web Vitals: LCP, CLS, and INP. Every render decision has a cost.

## Core Web Vitals Targets

| Metric | Target | Common v0 violation |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | Unoptimized hero images, blocking fonts |
| CLS (Cumulative Layout Shift) | < 0.1 | Missing image dimensions, dynamic content without reserved space |
| INP (Interaction to Next Paint) | < 200ms | Heavy client components, blocking JS |

## Images

v0 uses `<img>` tags. Always replace with Next.js `<Image />` for Next.js output.

- Use `next/image` — it enforces `width`/`height` (preventing CLS), serves WebP, and lazy-loads by default.
- Above-the-fold images (hero, header) must set `priority` to avoid LCP delay.
- Never use `<img>` for content images in Next.js output.
- Use explicit `width` and `height` props or `fill` with a sized parent — do not omit dimensions.

## Fonts

v0 uses CSS `@import` or `<link>` for Google Fonts, which blocks rendering.

- Replace with `next/font/google` — loads fonts at build time, zero layout shift, automatic `font-display: swap`.
- Declare fonts once at the layout level, not per-component.
- Prefer variable fonts (`wght` axis) over loading multiple font weights.

## Client vs. Server Components

Unnecessary `"use client"` directives inflate the JS bundle.

- Default to Server Components. Add `"use client"` only when the component uses browser APIs, event handlers, or hooks.
- Split large client components: extract the interactive piece into a small leaf component, keep the shell as a server component.
- Do not add `"use client"` just because v0 included it — audit each one.

## Code Splitting & Lazy Loading

- Use `next/dynamic` (or `React.lazy`) for components that are: below the fold, modal/drawer/dialog, or conditionally rendered.
- Pass a `loading` prop to `next/dynamic` for heavy components to avoid layout shift while the chunk loads.
- Do not dynamic-import small utility components — the overhead outweighs the benefit.

## Bundle Hygiene

- Avoid barrel imports (`import { everything } from "@/components"`) — they prevent tree shaking.
- Use specific imports: `import { Button } from "@/components/ui/button"`.
- Do not import entire icon libraries — import individual icons.

```pattern
<img |next/image|next/font|next/dynamic|"use client"|React\.lazy|loading=
```

```tsx
// ❌ v0 output — blocks rendering, causes CLS
import "@fontsource/inter";
<img src="/hero.jpg" alt="Hero" />

// ✅ Transformed — next/font, next/image with priority
import { Inter } from "next/font/google";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"], display: "swap" });

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority          // above the fold — avoids LCP penalty
/>

// ✅ Lazy-load below-fold or conditional components
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <div className="h-64 animate-pulse bg-muted rounded-lg" />,
});

// ✅ Narrow "use client" to the interactive leaf only
// page.tsx (Server Component)
export default function Page() {
  return (
    <main>
      <HeroSection />        {/* server component */}
      <LikeButton />         {/* "use client" leaf */}
    </main>
  );
}
```
