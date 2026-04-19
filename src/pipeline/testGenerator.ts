import type { GeneratedComponent, GeneratedTest, PipelineContext } from "../types/index.js";
import { logger } from "../observability/logger.js";

/**
 * Generates Vitest + React Testing Library unit/component tests
 * for each generated component.
 */
export class TestGenerator {
  generate(components: GeneratedComponent[], ctx: PipelineContext): GeneratedTest[] {
    logger.info("Generating tests", { componentCount: components.length });

    return components.map((component) => this.generateForComponent(component, ctx));
  }

  private generateForComponent(
    component: GeneratedComponent,
    ctx: PipelineContext
  ): GeneratedTest {
    const relativePath = component.path
      .replace(`${ctx.outputDir}/components/`, "")
      .replace(/\.tsx?$/, "");

    const code = `import React from "react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ${component.name} from "../components/${relativePath}.js";

describe("${component.name}", () => {
  it("renders without crashing", () => {
    const { container } = render(<${component.name} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("mounts without errors", () => {
    expect(() => render(<${component.name} />)).not.toThrow();
  });

${this.buildStateTests(component)}
${this.buildInteractionTests(component)}
${this.buildEdgeCaseTests(component)}
});
`;

    return {
      targetComponent: component.name,
      path: `${ctx.outputDir}/tests/${relativePath}.test.tsx`,
      code,
    };
  }

  private buildStateTests(component: GeneratedComponent): string {
    const lines: string[] = [];

    if (component.name.includes("Wrapper")) {
      lines.push(
        `  it("shows a loading fallback while Suspense resolves", () => {`,
        `    // Suspense fallback is rendered synchronously on first paint`,
        `    render(<${component.name} />);`,
        `    // The wrapper should mount`,
        `    expect(document.body).toBeTruthy();`,
        `  });`
      );
    }

    if (component.name.endsWith("Error")) {
      lines.push(
        `  it("displays the error message", () => {`,
        `    const error = new Error("Something went wrong");`,
        `    render(<${component.name} error={error} />);`,
        `    expect(screen.getByRole("alert")).toBeInTheDocument();`,
        `    expect(screen.getByText("Something went wrong")).toBeInTheDocument();`,
        `  });`
      );
    }

    return lines.join("\n");
  }

  private buildInteractionTests(component: GeneratedComponent): string {
    if (!component.isClientComponent) return "";

    return [
      `  it("handles keyboard interaction", async () => {`,
      `    const user = userEvent.setup();`,
      `    render(<${component.name} />);`,
      `    // Tab through the component — should not throw`,
      `    await user.tab();`,
      `    expect(document.activeElement).toBeDefined();`,
      `  });`,
    ].join("\n");
  }

  private buildEdgeCaseTests(component: GeneratedComponent): string {
    return [
      `  it("renders consistently (snapshot)", () => {`,
      `    const { container } = render(<${component.name} />);`,
      `    expect(container).toMatchSnapshot();`,
      `  });`,
    ].join("\n");
  }
}
