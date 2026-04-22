# frontend-pipeline

CLI-driven pipeline that converts Vercel v0 outputs into structured React/Next.js components, applying repo-defined skills, enforcing SSR/frontend standards, and injecting observability (logging, feature flags) with Vercel integrations.

---

## Overview

`frontend-pipeline` is a TypeScript CLI tool that orchestrates the following workflow:

1. **Accepts** a natural language prompt (or a pre-saved v0 design file)
2. **Sends** the prompt to Vercel v0 to generate a UI design
3. **Stores** the design locally under `temp/designs/`
4. **Validates** the design for feasibility, accessibility gaps, and missing UI states
5. **Transforms** the design into production-ready React/Next.js components
6. **Applies** repository skills/patterns from the `/skills` directory
7. **Adds** observability (structured logging, feature flags, error tracking)
8. **Generates** unit and component tests (Vitest + React Testing Library)
9. **Writes** all output to `temp/dist/<feature-name>/`

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- A [Vercel v0 API key](https://v0.dev) (required for live design generation)

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Run the CLI

```bash
# Generate components from a live v0 prompt
V0_API_KEY=<your-key> node dist/index.js generate \
  --prompt "Build a responsive dashboard card with loading and error states" \
  --feature-name "dashboard-card"

# Dry-run (no API key required, no files written)
node dist/index.js generate \
  --prompt "Build a product listing component" \
  --feature-name "product-list" \
  --dry-run --skip-validation

# Load a pre-saved design file
node dist/index.js generate \
  --design-file temp/designs/my-design.json \
  --feature-name "my-feature"

# List saved designs
node dist/index.js list-designs
```

---

## CLI Options

| Option | Default | Description |
|---|---|---|
| `-p, --prompt <text>` | — | Natural language prompt to send to Vercel v0 |
| `-n, --feature-name <name>` | — | Feature/component name (required) |
| `-o, --output-dir <dir>` | `temp/dist` | Base output directory |
| `-d, --design-file <path>` | — | Load a saved v0 design JSON instead of calling the API |
| `-u, --design-url <url>` | — | Fetch the latest code from an existing v0.app chat URL (requires `V0_API_KEY`) |
| `-f, --framework <nextjs\|react>` | `nextjs` | Target framework for generated components |
| `--skip-validation` | `false` | Skip design validation phase |
| `--skip-tests` | `false` | Skip test generation |
| `--skip-skills` | `false` | Skip applying repository skills |
| `--dry-run` | `false` | Print what would be generated without writing files |
| `-v, --verbose` | `false` | Enable debug logging |

---

## Output Structure

**Next.js (default):**
```
temp/dist/<feature-name>/
├── components/
│   ├── <feature-name>.tsx         # Primary component
│   └── <feature-name>-wrapper.tsx # Suspense-only wrapper
├── error.tsx                       # App Router error boundary (place at route segment)
├── hooks/
│   └── <feature-name>.ts          # Custom hook (if design has state)
├── tests/
└── index.ts                        # Barrel export
```

**React (`--framework react`):**
```
temp/dist/<feature-name>/
├── components/
│   ├── <feature-name>.tsx         # Primary component
│   └── <feature-name>-wrapper.tsx # Suspense + class ErrorBoundary wrapper
├── hooks/
│   └── <feature-name>.ts          # Custom hook (if design has state)
├── tests/
└── index.ts                        # Barrel export
```

---

## Repository Skills

Place Markdown files in `/skills/` to define patterns and conventions that the pipeline automatically applies to generated components.

Each skill file supports:

- `# Title` — skill name
- `> Description` — one-line summary
- ` ```pattern ` — regex matched against generated code
- ` ```tsx ` — example code

Built-in skills:
- `skills/server-components.md` — prefer Server Components
- `skills/accessibility.md` — WCAG 2.1 AA rules
- `skills/testing.md` — Vitest + RTL conventions
- `skills/tailwind.md` — Tailwind utility class patterns

---

## Feature Flags

Override any flag using environment variables:

```bash
PIPELINE_FLAG_ENABLE_V0_INTEGRATION=false    # disable live v0 API calls
PIPELINE_FLAG_ENABLE_SKILLS_ENGINE=false     # disable skills application
PIPELINE_FLAG_ENABLE_TEST_GENERATION=false   # disable test generation
PIPELINE_FLAG_ENABLE_ERROR_BOUNDARIES=false  # disable error boundary / error.tsx generation
PIPELINE_FLAG_ENABLE_STRUCTURED_LOGGING=true # enable JSON log output (default: false)
```

---

## Development

```bash
# Type-check
npm run typecheck

# Lint
npm run lint

# Test (Vitest)
npm test

# Test with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Project Structure

```
src/
├── index.ts                    # CLI entry point
├── cli/
│   ├── args.ts                 # Commander program setup
│   └── runner.ts               # Pipeline runner + output formatting
├── pipeline/
│   ├── index.ts                # Pipeline orchestrator
│   ├── v0Client.ts             # Vercel v0 API client
│   ├── designStore.ts          # Local design persistence
│   ├── validator.ts            # Design validation
│   ├── transformer.ts          # Component code generation
│   ├── skillsEngine.ts         # Repository skills loader + applicator
│   ├── testGenerator.ts        # Vitest/RTL test generation
│   └── outputWriter.ts         # File system output writer
├── observability/
│   ├── logger.ts               # Winston logger
│   ├── flags.ts                # Feature flags resolver
│   └── errorTracker.ts         # Error capture + reporting
├── types/
│   └── index.ts                # Shared TypeScript types
└── tests/
    ├── flags.test.ts
    ├── validator.test.ts
    ├── transformer.test.ts
    ├── designStore.test.ts
    ├── skillsEngine.test.ts
    ├── testGenerator.test.ts
    └── errorTracker.test.ts
skills/
├── server-components.md
├── accessibility.md
├── testing.md
└── tailwind.md
```

