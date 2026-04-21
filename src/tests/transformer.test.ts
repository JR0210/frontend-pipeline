import { describe, it, expect } from "vitest";
import { ComponentTransformer } from "../pipeline/transformer.js";
import type { V0Design, PipelineContext, FeatureFlags } from "../types/index.js";

const defaultFlags: FeatureFlags = {
  enableV0Integration: true,
  enableSkillsEngine: true,
  enableTestGeneration: true,
  enableErrorBoundaries: true,
  enableStructuredLogging: false,
};

function makeDesign(code: string, id = "design-1"): V0Design {
  return { id, prompt: "test", code, framework: "nextjs", createdAt: "" };
}

function makeCtx(
  featureName: string,
  code = "",
  framework: "nextjs" | "react" = "nextjs"
): PipelineContext {
  return {
    featureName,
    outputDir: "temp/dist/test-feature",
    design: makeDesign(code),
    flags: defaultFlags,
    verbose: false,
    framework,
  };
}

describe("ComponentTransformer", () => {
  const transformer = new ComponentTransformer();

  describe("transform", () => {
    it("returns two components (primary + wrapper)", () => {
      const ctx = makeCtx("dashboard-card");
      const components = transformer.transform(makeDesign("return <div/>;"), ctx);
      expect(components).toHaveLength(2);
    });

    it("generates correct component names from feature names", () => {
      const ctx = makeCtx("dashboard-card");
      const [primary, wrapper] = transformer.transform(makeDesign("return <div/>;"), ctx);
      expect(primary.name).toBe("DashboardCard");
      expect(wrapper.name).toBe("DashboardCardWrapper");
    });

    it("marks components with hooks as client components", () => {
      const code = `export function Counter() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
      }`;
      const ctx = makeCtx("counter");
      const [primary] = transformer.transform(makeDesign(code), ctx);
      expect(primary.isClientComponent).toBe(true);
      expect(primary.code).toContain('"use client"');
    });

    it("marks server components as non-client", () => {
      const code = `export function ServerCard() { return <div>hello</div>; }`;
      const ctx = makeCtx("server-card");
      const [primary] = transformer.transform(makeDesign(code), ctx);
      expect(primary.isClientComponent).toBe(false);
      expect(primary.code).not.toContain('"use client"');
    });

    it("sets correct output paths", () => {
      const ctx = makeCtx("my-button");
      const [primary] = transformer.transform(makeDesign("return <div/>;"), ctx);
      expect(primary.path).toContain("components/my-button.tsx");
    });

    it("wraps wrapper components with Suspense", () => {
      const ctx = makeCtx("hero-section");
      const [, wrapper] = transformer.transform(makeDesign("return <div/>;"), ctx);
      expect(wrapper.code).toContain("Suspense");
      expect(wrapper.code).toContain("HeroSectionSkeleton");
    });
  });

  describe("buildHook", () => {
    it("returns null when the design has no state hooks", () => {
      const ctx = makeCtx("static-card");
      const hook = transformer.buildHook(makeDesign("return <div/>;"), ctx);
      expect(hook).toBeNull();
    });

    it("returns a hook when the design uses useState", () => {
      const code = `
        const [items, setItems] = useState([]);
        useEffect(() => { fetchItems().then(setItems); }, []);
      `;
      const ctx = makeCtx("item-list");
      const hook = transformer.buildHook(makeDesign(code), ctx);
      expect(hook).not.toBeNull();
      expect(hook?.name).toBe("useItemList");
      expect(hook?.code).toContain("useEffect");
    });
  });
});
