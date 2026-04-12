import type {
  V0Design,
  GeneratedComponent,
  GeneratedHook,
  PipelineContext,
} from "../types/index.js";
import { logger } from "../observability/logger.js";

/** Determines whether a component needs the "use client" directive. */
function needsClientDirective(code: string): boolean {
  return (
    /useState|useEffect|useRef|useCallback|useMemo|useReducer/.test(code) ||
    /onClick|onChange|onSubmit|onBlur|onFocus/.test(code) ||
    /window\.|document\.|localStorage|sessionStorage/.test(code)
  );
}

/** Extracts a clean PascalCase component name from the feature name. */
function toComponentName(featureName: string): string {
  return featureName
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/** Converts camelCase / PascalCase to kebab-case for file names. */
function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

/**
 * Transforms a raw v0 design into a set of typed, production-ready
 * React/Next.js components following the project conventions.
 */
export class ComponentTransformer {
  /**
   * Derive the primary component and a loading/error wrapper from the design.
   */
  transform(design: V0Design, ctx: PipelineContext): GeneratedComponent[] {
    logger.info("Transforming design into components", { featureName: ctx.featureName });

    const componentName = toComponentName(ctx.featureName);
    const isClient = needsClientDirective(design.code);

    const primary = this.buildPrimaryComponent(design, componentName, isClient, ctx);
    const wrapper = this.buildWrapperComponent(componentName, ctx);

    return [primary, wrapper];
  }

  /** Generate a custom hook stub if the design contains stateful logic. */
  buildHook(design: V0Design, ctx: PipelineContext): GeneratedHook | null {
    const hasState = /useState|useEffect|useReducer/.test(design.code);
    if (!hasState) return null;

    const componentName = toComponentName(ctx.featureName);
    const hookName = `use${componentName}`;
    const kebabName = toKebabCase(componentName);

    const code = `import { useState, useEffect } from "react";

export interface ${componentName}State {
  data: unknown | null;
  loading: boolean;
  error: Error | null;
}

export function ${hookName}(): ${componentName}State {
  const [data, setData] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        // TODO: replace with actual data fetching logic
        const result = await Promise.resolve(null);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
`;

    return {
      name: hookName,
      path: `${ctx.outputDir}/hooks/${kebabName}.ts`,
      code,
    };
  }

  private buildPrimaryComponent(
    design: V0Design,
    componentName: string,
    isClient: boolean,
    ctx: PipelineContext
  ): GeneratedComponent {
    const clientDirective = isClient ? '"use client";\n\n' : "";
    const kebabName = toKebabCase(componentName);

    const errorBoundaryImport =
      ctx.flags.enableErrorBoundaries && !isClient
        ? `import { Suspense } from "react";\n`
        : "";

    const code = `${clientDirective}import React from "react";
${errorBoundaryImport}
export interface ${componentName}Props {
  className?: string;
}

/**
 * ${componentName} — generated from v0 design ${design.id}.
 * ${isClient ? "Client Component" : "Server Component (default)"}
 */
export function ${componentName}({ className }: ${componentName}Props) {
  return (
    <div className={className}>
      {/* v0-generated design — begin */}
${indentCode(design.code, 6)}
      {/* v0-generated design — end */}
    </div>
  );
}

export default ${componentName};
`;

    return {
      name: componentName,
      path: `${ctx.outputDir}/components/${kebabName}.tsx`,
      code,
      isClientComponent: isClient,
      hasTests: false,
    };
  }

  private buildWrapperComponent(componentName: string, ctx: PipelineContext): GeneratedComponent {
    const kebabName = toKebabCase(componentName);

    const code = `import React, { Suspense } from "react";
import { ${componentName} } from "./${kebabName}.js";

interface ${componentName}WrapperProps {
  className?: string;
}

function ${componentName}Skeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading ${componentName}">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

function ${componentName}Error({ error }: { error: Error }) {
  return (
    <div role="alert" className="text-red-600 p-4 border border-red-300 rounded">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm">{error.message}</p>
    </div>
  );
}

/**
 * ${componentName}Wrapper — wraps ${componentName} with Suspense + error handling.
 * Safe to use in SSR/Server Component trees.
 */
export function ${componentName}Wrapper({ className }: ${componentName}WrapperProps) {
  return (
    <Suspense fallback={<${componentName}Skeleton />}>
      <${componentName} className={className} />
    </Suspense>
  );
}

export { ${componentName}Error, ${componentName}Skeleton };
export default ${componentName}Wrapper;
`;

    return {
      name: `${componentName}Wrapper`,
      path: `${ctx.outputDir}/components/${kebabName}-wrapper.tsx`,
      code,
      isClientComponent: false,
      hasTests: false,
    };
  }
}

function indentCode(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? `${pad}${line}` : line))
    .join("\n");
}
