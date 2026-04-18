---
name: frontend-design
description: Enforce distinctive, production-grade aesthetics when transforming v0-generated code. Use this skill when the pipeline is enhancing, validating, or refining v0 output into production-ready frontend components, pages, or applications. Ensures transformed code avoids generic AI aesthetics and upholds strong design quality.
---

This skill guides the automated transformation of v0-generated frontend code into distinctive, production-grade interfaces. When processing v0 output, enforce real working code with exceptional attention to aesthetic details — elevating what v0 produces beyond its generic defaults.

# Frontend Design

> Transformed v0 output must meet production design standards: distinctive typography, cohesive CSS variable systems, purposeful motion, and an intentional aesthetic direction that avoids generic AI output.

The pipeline receives v0-generated components and pages. This skill enforces quality gates and drives the augmentation pass so the final output reads as intentionally designed, not AI-generated.

## What to Audit in v0 Output

Before passing v0 output downstream, evaluate and fix:

- **Typography**: v0 almost always defaults to Inter or system-ui. These are fine fonts but their ubiquity makes output feel undesigned — prefer distinctive, characterful pairings where the design context justifies it. A display font for headings paired with a refined body font elevates perceived quality significantly.
- **Color systems**: Replace flat or arbitrary hex values with CSS custom properties (`--color-*`). Ensure a dominant palette with intentional accent colors — not timid evenly-distributed palettes or clichéd purple-on-white gradients.
- **Layouts**: Flag predictable, symmetric grid layouts. Introduce asymmetry, overlap, or grid-breaking elements where it serves the design goal.
- **Backgrounds**: Replace bare solid-color backgrounds with contextually appropriate depth — gradient meshes, noise textures, layered transparencies, or dramatic shadows that create atmosphere.
- **Motion**: Add purposeful CSS animations for the most impactful moments (page-load stagger, hover reveals) rather than omitting animation entirely or scattering micro-interactions indiscriminately.

## Production Transformation Rules

When rewriting or augmenting v0 output, enforce:

- **CSS variables**: All colors, spacing tokens, and font sizes must use `--var` custom properties. No magic numbers or hardcoded hex values in component styles.
- **Semantic HTML**: Replace `<div>`-heavy markup with `<main>`, `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>` where appropriate.
- **Responsive**: Components must be intentionally scoped to their target breakpoints. Separate mobile and desktop variants are acceptable and often preferable over a single component stretched across all viewports — but each variant must be fully functional within its intended range.
- **Performance**: No layout-blocking fonts. Use `font-display: swap`. Prefer variable fonts where multiple weights are needed. Avoid large inline SVGs that should be sprites or external assets.
- **Accessibility**: Coordinate with the Accessibility skill — all interactive elements must be keyboard navigable and screen-reader friendly.

## Aesthetic Direction

Commit to a bold, specific aesthetic rather than v0's neutral defaults. Pick an extreme and execute it with precision:

> Brutally minimal · Maximalist chaos · Retro-futuristic · Organic/natural · Luxury/refined · Playful/toy-like · Editorial/magazine · Brutalist/raw · Art deco/geometric · Soft/pastel · Industrial/utilitarian

**What makes this output UNFORGETTABLE?** Identify the single defining design choice and amplify it — it should be unmistakably present in the final output.

Avoid letting v0's neutral defaults define the output:
- **Fonts**: Inter, Roboto, and Space Grotesk are competent choices but overrepresented in AI output — replace them when the design context calls for something with more character. They're acceptable as fallbacks in utility components.
- **Color**: Clichéd purple/blue gradients on white or off-white backgrounds signal unreviewed v0 output; replace with a considered palette.
- **Layout**: Predictable symmetric card grids with identical spacing are appropriate for data-dense tools and dashboards but should be a deliberate choice, not a default.
- **Components**: Purely functional utility components (tables, form controls, modals) don't need distinctive styling — focus design effort on surfaces that users actually perceive as "the interface".

Vary aesthetic direction across pipeline runs. No two outputs should converge on the same font–color–layout combination.

```pattern
className|font-family|color:|background|animation|keyframes|css|styled|@apply|theme
```

```tsx
// ✅ Production-ready: CSS custom properties replace v0 hardcoded values
// Before (v0 output):  color: #6366f1;  font-family: Inter, system-ui;
// After (transformed):
:root {
  --color-primary: #1a1a2e;
  --color-accent: #e94560;
  --font-display: "Cormorant Garamond", serif;   /* distinctive display */
  --font-body: "DM Sans", sans-serif;             /* refined body */
}

// ✅ Semantic structure replacing div-soup
<main className="layout-root">
  <header className="site-header">...</header>
  <article className="content-body">...</article>
  <aside className="sidebar">...</aside>
</main>

// ✅ Purposeful animation (staggered reveal, not scattered micro-interactions)
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(1rem); }
  to   { opacity: 1; transform: translateY(0); }
}
.card { animation: fadeUp 0.4s ease both; }
.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.2s; }

// ❌ Flag and replace — generic v0 defaults
// font-family: Inter, system-ui, sans-serif;
// background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
// color: #6366f1;
```
