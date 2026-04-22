---
name: testing
description: Generate Vitest + React Testing Library test suites for v0-generated components. Use this skill when the pipeline is producing test files alongside transformed output, ensuring components have rendering, interaction, edge case, and snapshot coverage.
---

This skill guides the automated generation of test files for components produced by the pipeline. Every component emitted by the pipeline should be accompanied by a test suite — use these patterns to produce correct, idiomatic Vitest + React Testing Library coverage.

# Testing

> Every component must have Vitest + React Testing Library coverage.

Test strategy:
1. **Rendering** — component mounts without throwing
2. **Interaction** — user events produce expected UI changes
3. **Edge cases** — empty, loading, and error states are handled
4. **Snapshots** — prevent unintended regressions

Use `@testing-library/user-event` for interactions; avoid `fireEvent` where possible.

```pattern
render|screen|userEvent|describe|it\(|test\(
```

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders a heading", () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
  });

  it("calls onSubmit when the form is submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MyComponent onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
```
