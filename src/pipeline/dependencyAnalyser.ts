import path from "node:path";
import type { GeneratedComponent, GeneratedHook, ExternalDependency } from "../types/index.js";

/**
 * Packages that are safe / expected in the pipeline's output.
 * These are either built-in to React/Next.js or explicitly supported.
 */
const KNOWN_PACKAGES = new Set([
  "react",
  "react-dom",
  "next",
  "next/link",
  "next/image",
  "next/navigation",
  "next/router",
  "next/head",
  "node:fs",
  "node:path",
  "node:url",
]);

/**
 * Analyser that scans generated component and hook code for third-party
 * imports that are not part of the pipeline's known dependency set.
 *
 * Does NOT transform the code — only reports what it finds.
 */
export class DependencyAnalyser {
  /**
   * Analyse all components and hooks, returning one ExternalDependency entry
   * per (package, sourceFile) pair with the list of imported symbols.
   */
  analyse(
    components: GeneratedComponent[],
    hooks: GeneratedHook[],
  ): ExternalDependency[] {
    const results: ExternalDependency[] = [];

    for (const item of [...components, ...hooks]) {
      const found = this.extractImports(item.code, item.path);
      results.push(...found);
    }

    return results;
  }

  /**
   * Inject a TODO comment block at the top of a component/hook's code
   * listing each external dependency that needs to be installed in the
   * target project.
   */
  annotateCode(code: string, deps: ExternalDependency[]): string {
    if (deps.length === 0) return code;

    const unique = [...new Map(deps.map((d) => [d.package, d])).values()];

    const installable = unique
      .map((d) => normaliseToNpmPackage(d.package))
      .filter((p) => p !== "(local alias)");

    const lines = [
      "/**",
      " * ⚠️  External dependencies required in your target project:",
      ...unique.map((d) => ` *    ${d.package}  →  ${d.symbols.join(", ")}`),
      ...(installable.length > 0
        ? [" *", ` *    npm install ${installable.join(" ")}`]
        : []),
      " */",
    ];

    return `${lines.join("\n")}\n${code}`;
  }

  private extractImports(code: string, filePath: string): ExternalDependency[] {
    const results: ExternalDependency[] = [];
    // Match: import ... from "package" or import ... from 'package'
    const importRe = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;

    while ((m = importRe.exec(code)) !== null) {
      const specifier = m[1];
      if (this.isKnown(specifier)) continue;

      const symbols = extractSymbols(m[0]);
      const existing = results.find((r) => r.package === specifier);
      if (existing) {
        for (const s of symbols) {
          if (!existing.symbols.includes(s)) existing.symbols.push(s);
        }
      } else {
        results.push({ package: specifier, symbols, sourceFile: path.basename(filePath) });
      }
    }

    return results;
  }

  private isKnown(specifier: string): boolean {
    if (KNOWN_PACKAGES.has(specifier)) return true;
    // Relative imports are fine
    if (specifier.startsWith(".")) return true;
    // Next.js sub-paths
    if (specifier.startsWith("next/")) return true;
    return false;
  }
}

/** Extract named and default symbols from a single import statement. */
function extractSymbols(importStatement: string): string[] {
  const symbols: string[] = [];

  // Named: { Foo, Bar }
  const namedMatch = importStatement.match(/\{([^}]+)\}/);
  if (namedMatch) {
    symbols.push(
      ...namedMatch[1]
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean),
    );
  }

  // Default import: import Foo from ...
  const defaultMatch = importStatement.match(/import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from/);
  if (defaultMatch && !importStatement.includes("{")) {
    symbols.push(defaultMatch[1]);
  }

  return symbols.length > 0 ? symbols : ["(default)"];
}

/** Convert a path-style specifier like "@/components/ui/button" to its npm package root. */
function normaliseToNpmPackage(specifier: string): string {
  // @/... is a local path alias — not an npm package
  if (specifier.startsWith("@/")) return "(local alias)";
  // Scoped package: @scope/package/sub → @scope/package
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  // Regular package: package/sub → package
  return specifier.split("/")[0];
}
