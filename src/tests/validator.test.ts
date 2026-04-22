import { describe, it, expect } from "vitest";
import { DesignValidator } from "../pipeline/validator.js";
import type { V0Design } from "../types/index.js";

function makeDesign(code: string): V0Design {
  return {
    id: "test-id",
    prompt: "test prompt",
    code,
    framework: "nextjs",
    createdAt: new Date().toISOString(),
  };
}

describe("DesignValidator", () => {
  const validator = new DesignValidator();

  it("returns valid=false for an empty design", () => {
    const result = validator.validate(makeDesign(""));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Design code is empty.");
  });

  it("returns valid=true for a basic component", () => {
    const code = `
      export function Card({ loading, error }: Props) {
        if (loading) return <Skeleton />;
        if (error) return <Error />;
        return <div>content</div>;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.valid).toBe(true);
  });

  it("detects missing loading state", () => {
    const code = `
      export function Card({ error }: Props) {
        if (error) return <Error />;
        return <div>content</div>;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.missingStates).toContain("loading");
    expect(result.missingStates).not.toContain("error");
  });

  it("detects missing error state", () => {
    const code = `
      export function Card({ loading }: Props) {
        if (loading) return <Skeleton />;
        return <div>content</div>;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.missingStates).toContain("error");
    expect(result.missingStates).not.toContain("loading");
  });

  it("warns about client-only APIs", () => {
    const code = `
      export function Widget() {
        const val = window.localStorage.getItem("key");
        return <div>{val}</div>;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("warns about images without alt text", () => {
    const code = `
      export function Banner() {
        if (loading) return null;
        if (error) return null;
        return <img src="/banner.jpg" />;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.warnings.some((w) => w.includes("alt"))).toBe(true);
  });

  it("does not warn about images that have alt text", () => {
    const code = `
      export function Banner() {
        if (loading) return null;
        if (error) return null;
        return <img src="/banner.jpg" alt="A banner" />;
      }
    `;
    const result = validator.validate(makeDesign(code));
    expect(result.warnings.every((w) => !w.includes("alt"))).toBe(true);
  });
});
