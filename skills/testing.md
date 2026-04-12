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
