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
 * Parses a multi-file v0 code string (lines starting with `// /path`)
 * into individual { path, content } sections.
 * Falls back to a single section with the full code when no headers found.
 */
function parseFileSections(code: string): Array<{ path: string; content: string }> {
  const headerRe = /^\/\/ (\/[^\n]+)/gm;
  const indices: Array<{ path: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(code)) !== null) {
    indices.push({ path: m[1], index: m.index });
  }
  if (indices.length === 0) return [{ path: "design.tsx", content: code }];

  return indices.map((entry, i) => {
    const start = code.indexOf("\n", entry.index) + 1;
    const end = i + 1 < indices.length ? indices[i + 1].index : code.length;
    return { path: entry.path, content: code.slice(start, end).trim() };
  });
}

/**
 * From a (possibly multi-file) v0 code string, extract the content of the
 * single most-relevant component file.
 * Priority: page.tsx > first .tsx > first file.
 */
function extractPrimaryCode(code: string): string {
  const sections = parseFileSections(code);
  if (sections.length === 1) return code;

  const primary =
    sections.find((s) => s.path.endsWith("page.tsx")) ??
    sections.find((s) => s.path.endsWith(".tsx")) ??
    sections[0];

  return primary.content;
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
    const primaryCode = extractPrimaryCode(design.code);
    const isClient = needsClientDirective(primaryCode);
    const hasNamedExport = new RegExp(`export\\s+(function|const|class)\\s+${componentName}\\b`).test(primaryCode);

    const primary = this.buildPrimaryComponent(design, componentName, isClient, ctx);
    const wrapper = this.buildWrapperComponent(componentName, ctx, hasNamedExport);

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

    const primaryCode = extractPrimaryCode(design.code);
    const isCompleteModule = /export\s+(default\s+)?(function|const|class|async)/.test(primaryCode);

    let code: string;

    if (isCompleteModule) {
      // v0 returned a full TypeScript module — emit it directly.
      // Ensure "use client" is at the top if needed and not already present.
      const alreadyHasDirective = /^['"]use client['"]/.test(primaryCode.trimStart());
      const directive = isClient && !alreadyHasDirective ? '"use client";\n\n' : "";
      code = `${directive}${primaryCode}\n`;
    } else {
      // v0 returned a partial JSX fragment — wrap it in a component shell.
      code = `${clientDirective}import React from "react";

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
${indentCode(primaryCode, 6)}
      {/* v0-generated design — end */}
    </div>
  );
}

export default ${componentName};
`;
    }

    // Guarantee a named export so barrel `export *` always re-exports the component.
    const hasDirectNamedExport = new RegExp(
      `export\\s+(function|const|class)\\s+${componentName}\\b|export\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}`
    ).test(code);
    if (!hasDirectNamedExport && code.includes("export default")) {
      code = code.trimEnd() + `\nexport { default as ${componentName} };\n`;
    }

    return {
      name: componentName,
      path: `${ctx.outputDir}/components/${kebabName}.tsx`,
      code,
      isClientComponent: isClient,
      hasTests: false,
    };
  }

  private buildWrapperComponent(
    componentName: string,
    ctx: PipelineContext,
    hasNamedExport = true,
  ): GeneratedComponent {
    const kebabName = toKebabCase(componentName);
    // Use named import when available, default import when the module only has export default
    const importLine = hasNamedExport
      ? `import { ${componentName} } from "./${kebabName}.js";`
      : `import ${componentName} from "./${kebabName}.js";`;

    const code = `import React, { Suspense } from "react";
${importLine}

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
