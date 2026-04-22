---
name: accessibility
description: Enforce WCAG 2.1 AA compliance on v0-generated code. Use this skill when the pipeline is auditing or transforming v0 output to ensure all interactive elements are keyboard navigable, screen-reader friendly, and meet accessibility standards.
---

This skill guides the pipeline's accessibility audit pass on v0-generated components. v0 frequently omits ARIA attributes, uses non-semantic markup, and skips label associations — apply these rules during transformation to produce output that meets WCAG 2.1 AA standards.

# Accessibility

> All interactive elements must be keyboard navigable and screen-reader friendly.

Follow WCAG 2.1 AA guidelines:
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`, `<section>`)
- Provide `alt` text for all `<img>` elements
- Associate `<label>` elements with form controls via `htmlFor`
- Add `aria-label` or `aria-labelledby` to icon-only buttons
- Use `role="alert"` for error messages rendered dynamically
- Ensure sufficient colour contrast ratios (4.5:1 for normal text)

```pattern
<img|<button|<input|<form|onClick
```

```tsx
// ✅ Accessible image
<img src="/hero.jpg" alt="A hero image showing our product" />

// ✅ Accessible icon button
<button aria-label="Close dialog">
  <XIcon aria-hidden="true" />
</button>

// ✅ Accessible form field
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

// ✅ Dynamic error alert
<div role="alert" aria-live="assertive">{error}</div>
```
