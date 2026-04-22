import fs from "node:fs/promises";
import path from "node:path";
import type { V0Design } from "../types/index.js";
import { logger } from "../observability/logger.js";

const DESIGNS_DIR = path.resolve("temp", "designs");

/**
 * Persists and retrieves v0 designs from the local filesystem.
 * Designs are stored as JSON files under `temp/designs/<id>.json`.
 */
export class DesignStore {
  private readonly dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? DESIGNS_DIR;
  }

  /** Save a design to disk and return the file path. */
  async save(design: V0Design): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true });
    const filePath = path.join(this.dir, `${this.sanitizeId(design.id)}.json`);
    await fs.writeFile(filePath, JSON.stringify(design, null, 2), "utf-8");
    logger.info("Design saved", { path: filePath });
    return filePath;
  }

  /** Load a design by its ID. */
  async load(id: string): Promise<V0Design> {
    const filePath = path.join(this.dir, `${this.sanitizeId(id)}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as V0Design;
  }

  /** Load a design from an explicit file path. */
  async loadFromPath(filePath: string): Promise<V0Design> {
    const resolved = path.resolve(filePath);
    if (!resolved.endsWith(".json")) {
      throw new Error(`Design file must be a .json file: ${filePath}`);
    }
    const raw = await fs.readFile(resolved, "utf-8");
    return JSON.parse(raw) as V0Design;
  }

  /** Return true when a design file for `id` exists on disk. */
  async exists(id: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.dir, `${this.sanitizeId(id)}.json`));
      return true;
    } catch {
      return false;
    }
  }

  private sanitizeId(id: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid design ID — must contain only letters, digits, hyphens, and underscores: "${id}"`);
    }
    return id;
  }

  /** List all persisted design IDs. */
  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }
}
